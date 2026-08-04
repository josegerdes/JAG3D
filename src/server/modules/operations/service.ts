import { ClientSession, Db, ObjectId } from "mongodb";

import { ApiError } from "@/server/auth/guards";
import { Session } from "@/server/auth/session";
import { getMongoClient } from "@/server/db/client";
import { collections } from "@/server/db/collections";
import { MeshAssetDoc, OperationLogDoc } from "@/server/db/schema";
import { applyDelta } from "@/server/lib/rigid-transform";
import { getCaseForSession } from "@/server/modules/cases/service";
import * as assetsRepo from "@/server/modules/mesh-assets/repository";
import { CommitOperationInput } from "@/server/modules/operations/types";

/**
 * Nucleo do mecanismo anti-dessincronizacao (ver ARCHITECTURE.md). Toda mutacao geometrica
 * (transform, corte booleano, alivio, duplicar, apagar) passa por aqui: checa `syncVersion`
 * otimista de cada alvo (409 em mismatch, nunca merge silencioso), aplica a mudanca, propaga o
 * MESMO delta de transform pras malhas vinculadas (`linkedGroupId`) e grava tudo — incluindo o
 * `OperationLogDoc` (pilha de undo/redo) — dentro de uma unica Mongo transaction multi-documento.
 *
 * Exige que `mongo` rode como replica set (`rs0`) — ver docker-compose.yml/ARCHITECTURE.md. Um erro
 * "Transaction numbers are only allowed on a replica set member" aqui significa que o
 * `mongo-init` nao rodou.
 */
export async function commitOperation(db: Db, session: Session, input: CommitOperationInput) {
  const caseDoc = await getCaseForSession(db, session, input.caseId);

  const client = await getMongoClient();
  const mongoSession = client.startSession();
  try {
    let result: { sequence: number; syncVersions: Record<string, number> } | undefined;
    await mongoSession.withTransaction(async () => {
      result = await runCommit(db, mongoSession, session, caseDoc._id, input);
    });
    if (!result) throw new ApiError(500, "Falha ao commitar operacao");
    return result;
  } finally {
    await mongoSession.endSession();
  }
}

async function runCommit(
  db: Db,
  mongoSession: ClientSession,
  session: Session,
  caseId: ObjectId,
  input: CommitOperationInput
) {
  const primaryIds = input.targets.map((t) => ObjectId.createFromHexString(t.assetId));
  const primaryAssets = await collections
    .meshAssets(db)
    .find({ _id: { $in: primaryIds }, deleted: false }, { session: mongoSession })
    .toArray();
  if (primaryAssets.length !== primaryIds.length) {
    throw new ApiError(404, "Uma ou mais malhas alvo nao foram encontradas");
  }
  for (const asset of primaryAssets) {
    if (!asset.caseId.equals(caseId)) throw new ApiError(422, "Todas as malhas devem pertencer ao caso informado");
  }

  for (const target of input.targets) {
    const asset = primaryAssets.find((a) => a._id.toHexString() === target.assetId);
    if (asset && asset.syncVersion !== target.expectedSyncVersion) {
      throw new ApiError(409, `Malha "${asset.name}" foi alterada por outra sessao — recarregue o caso`);
    }
  }

  const linkedGroupIds = Array.from(
    new Set(primaryAssets.map((a) => a.linkedGroupId?.toHexString()).filter((v): v is string => Boolean(v)))
  );
  const siblingAssets = linkedGroupIds.length
    ? await collections
        .meshAssets(db)
        .find(
          {
            linkedGroupId: { $in: linkedGroupIds.map((id) => ObjectId.createFromHexString(id)) },
            _id: { $nin: primaryIds },
            deleted: false,
          },
          { session: mongoSession }
        )
        .toArray()
    : [];

  const now = new Date();
  const beforeState: Record<string, unknown> = {};
  const afterState: Record<string, unknown> = {};
  const syncVersionBefore: Record<string, number> = {};
  for (const asset of [...primaryAssets, ...siblingAssets]) {
    syncVersionBefore[asset._id.toHexString()] = asset.syncVersion;
    beforeState[asset._id.toHexString()] = { transform: asset.transform, storageKey: asset.storageKey };
  }

  for (const target of input.targets) {
    const asset = primaryAssets.find((a) => a._id.toHexString() === target.assetId);
    if (!asset) continue;

    const patch: Partial<MeshAssetDoc> = { updatedAt: now };
    if (target.transformDelta) patch.transform = applyDelta(asset.transform, target.transformDelta);
    if (target.geometryReplacement) {
      patch.storageKey = target.geometryReplacement.storageKey;
      patch.checksumSha256 = target.geometryReplacement.checksumSha256;
      patch.sizeBytes = target.geometryReplacement.sizeBytes;
      patch.triangleCount = target.geometryReplacement.triangleCount;
    }

    await collections
      .meshAssets(db)
      .updateOne({ _id: asset._id }, { $set: patch, $inc: { syncVersion: 1 } }, { session: mongoSession });
    afterState[asset._id.toHexString()] = patch;

    if (target.transformDelta && asset.linkedGroupId) {
      const siblings = siblingAssets.filter((s) => s.linkedGroupId?.equals(asset.linkedGroupId as ObjectId));
      for (const sibling of siblings) {
        const newTransform = applyDelta(sibling.transform, target.transformDelta);
        await collections
          .meshAssets(db)
          .updateOne(
            { _id: sibling._id },
            { $set: { transform: newTransform, updatedAt: now }, $inc: { syncVersion: 1 } },
            { session: mongoSession }
          );
        afterState[sibling._id.toHexString()] = { transform: newTransform };
      }
    }
  }

  const touchedIds = [...primaryAssets, ...siblingAssets].map((a) => a._id);
  const finalAssets = await collections
    .meshAssets(db)
    .find({ _id: { $in: touchedIds } }, { session: mongoSession })
    .toArray();
  const syncVersionAfter: Record<string, number> = {};
  for (const asset of finalAssets) syncVersionAfter[asset._id.toHexString()] = asset.syncVersion;

  const sequence = await nextSequence(db, caseId, mongoSession);
  const log: OperationLogDoc = {
    _id: new ObjectId(),
    ownerId: ObjectId.createFromHexString(session.userId),
    caseId,
    sequence,
    type: input.type,
    targetAssetIds: touchedIds,
    beforeState,
    afterState,
    syncVersionBefore,
    syncVersionAfter,
    userId: ObjectId.createFromHexString(session.userId),
    status: "committed",
    committedAt: now,
  };
  await collections.operationLogs(db).insertOne(log, { session: mongoSession });

  return { sequence, syncVersions: syncVersionAfter };
}

async function nextSequence(db: Db, caseId: ObjectId, mongoSession: ClientSession): Promise<number> {
  const [top] = await collections
    .operationLogs(db)
    .find({ caseId }, { session: mongoSession })
    .sort({ sequence: -1 })
    .limit(1)
    .toArray();
  return (top?.sequence ?? 0) + 1;
}

/** Desfaz a ultima operacao "committed" do caso, restaurando `beforeState` — tambem transacional. */
export async function undoLastOperation(db: Db, session: Session, caseId: string) {
  const caseDoc = await getCaseForSession(db, session, caseId);

  const client = await getMongoClient();
  const mongoSession = client.startSession();
  try {
    let result: { undoneOperationId: string; type: string } | undefined;
    await mongoSession.withTransaction(async () => {
      const [lastOp] = await collections
        .operationLogs(db)
        .find({ caseId: caseDoc._id, status: "committed" }, { session: mongoSession })
        .sort({ sequence: -1 })
        .limit(1)
        .toArray();
      if (!lastOp) throw new ApiError(404, "Nao ha operacao para desfazer");

      const beforeState = lastOp.beforeState as Record<
        string,
        { transform?: MeshAssetDoc["transform"]; storageKey?: string } | null
      >;
      for (const [assetIdHex, state] of Object.entries(beforeState)) {
        const assetObjectId = ObjectId.createFromHexString(assetIdHex);
        if (state === null) {
          // `beforeState` null significa que o asset nao existia antes da operacao (ex: duplicar)
          // — desfazer e apaga-lo, nao restaurar campo nenhum.
          await collections
            .meshAssets(db)
            .updateOne({ _id: assetObjectId }, { $set: { deleted: true, updatedAt: new Date() } }, { session: mongoSession });
          continue;
        }
        const patch: Partial<MeshAssetDoc> = { updatedAt: new Date() };
        if (state.transform) patch.transform = state.transform;
        if (state.storageKey) patch.storageKey = state.storageKey;
        await collections
          .meshAssets(db)
          .updateOne({ _id: assetObjectId }, { $set: patch, $inc: { syncVersion: 1 } }, { session: mongoSession });
      }

      await collections
        .operationLogs(db)
        .updateOne({ _id: lastOp._id }, { $set: { status: "undone" } }, { session: mongoSession });
      result = { undoneOperationId: lastOp._id.toHexString(), type: lastOp.type };
    });
    if (!result) throw new ApiError(500, "Falha ao desfazer operacao");
    return result;
  } finally {
    await mongoSession.endSession();
  }
}

export interface IntegrityReport {
  inSync: boolean;
  serverSyncVersions: Record<string, number>;
  mismatchedAssetIds: string[];
}

/** Endpoint de deteccao (nao so prevencao) — compara o cache do cliente com o servidor. Qualquer
 *  divergencia fora do fluxo normal de commitOperation() acende o indicador de sync na UI. */
export async function checkIntegrity(
  db: Db,
  session: Session,
  caseId: string,
  clientSyncVersions: Record<string, number>
): Promise<IntegrityReport> {
  const caseDoc = await getCaseForSession(db, session, caseId);
  const assets = await assetsRepo.findAssetsByCase(db, caseDoc._id);

  const serverSyncVersions: Record<string, number> = {};
  const mismatchedAssetIds: string[] = [];
  for (const asset of assets) {
    const id = asset._id.toHexString();
    serverSyncVersions[id] = asset.syncVersion;
    if (clientSyncVersions[id] !== undefined && clientSyncVersions[id] !== asset.syncVersion) {
      mismatchedAssetIds.push(id);
    }
  }
  return { inSync: mismatchedAssetIds.length === 0, serverSyncVersions, mismatchedAssetIds };
}
