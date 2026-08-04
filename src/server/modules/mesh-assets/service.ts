import { Db, ObjectId } from "mongodb";

import { ApiError } from "@/server/auth/guards";
import { Session } from "@/server/auth/session";
import { collections } from "@/server/db/collections";
import { identityTransform, MeshAssetDoc, OperationLogDoc } from "@/server/db/schema";
import { getCaseForSession } from "@/server/modules/cases/service";
import * as assetsRepo from "@/server/modules/mesh-assets/repository";
import { sniffMeshFormat } from "@/server/modules/mesh-assets/format-sniff";
import { checksumOf, deleteMeshFile, readMeshFile, saveMeshFile, storageKeyFor } from "@/server/modules/mesh-assets/storage";
import { MAX_MESH_UPLOAD_BYTES, UpdateMeshAssetInput } from "@/server/modules/mesh-assets/types";

export function toPublicAsset(doc: MeshAssetDoc) {
  return {
    id: doc._id.toHexString(),
    caseId: doc.caseId.toHexString(),
    groupId: doc.groupId?.toHexString() ?? null,
    name: doc.name,
    format: doc.format,
    sizeBytes: doc.sizeBytes,
    triangleCount: doc.triangleCount,
    transform: doc.transform,
    linkedGroupId: doc.linkedGroupId?.toHexString() ?? null,
    syncVersion: doc.syncVersion,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listAssetsForCase(db: Db, session: Session, caseId: string) {
  await getCaseForSession(db, session, caseId);
  const assets = await assetsRepo.findAssetsByCase(db, ObjectId.createFromHexString(caseId));
  return assets.map(toPublicAsset);
}

export async function uploadMeshAsset(
  db: Db,
  session: Session,
  caseId: string,
  name: string,
  buffer: Buffer
) {
  if (buffer.byteLength > MAX_MESH_UPLOAD_BYTES) {
    throw new ApiError(413, "Arquivo excede o tamanho maximo permitido (300MB)");
  }
  const caseDoc = await getCaseForSession(db, session, caseId);

  const { format, triangleCount } = sniffMeshFormat(buffer, name);
  const checksumSha256 = checksumOf(buffer);
  const storageKey = storageKeyFor(checksumSha256, format);
  await saveMeshFile(storageKey, buffer);

  const now = new Date();
  const doc: MeshAssetDoc = {
    _id: new ObjectId(),
    ownerId: caseDoc.ownerId,
    caseId: caseDoc._id,
    groupId: null,
    name,
    format,
    storageKey,
    checksumSha256,
    sizeBytes: buffer.byteLength,
    triangleCount,
    transform: identityTransform(),
    linkedGroupId: null,
    syncVersion: 0,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  await assetsRepo.insertAsset(db, doc);
  return toPublicAsset(doc);
}

async function getOwnedAsset(db: Db, session: Session, assetId: string) {
  const asset = await assetsRepo.findAssetById(db, assetId);
  if (!asset) throw new ApiError(404, "Malha nao encontrada");
  await getCaseForSession(db, session, asset.caseId.toHexString());
  return asset;
}

export async function updateMeshAsset(db: Db, session: Session, assetId: string, input: UpdateMeshAssetInput) {
  await getOwnedAsset(db, session, assetId);
  const patch: Partial<MeshAssetDoc> = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.groupId !== undefined && { groupId: input.groupId ? ObjectId.createFromHexString(input.groupId) : null }),
    ...(input.linkedGroupId !== undefined && {
      linkedGroupId: input.linkedGroupId ? ObjectId.createFromHexString(input.linkedGroupId) : null,
    }),
  };
  const updated = await assetsRepo.updateAsset(db, assetId, patch);
  if (!updated) throw new ApiError(404, "Malha nao encontrada");
  return toPublicAsset(updated);
}

export async function deleteMeshAsset(db: Db, session: Session, assetId: string) {
  const asset = await getOwnedAsset(db, session, assetId);
  await assetsRepo.softDeleteAsset(db, assetId);
  return asset;
}

/**
 * Duplicar e aditivo (cria um `MeshAssetDoc` novo), nao uma mutacao de um asset existente — por
 * isso nao passa por `commitOperation()` (que existe pra sincronizar mutacoes entre malhas
 * vinculadas). Como o storage e endereçado por conteudo, duplicar NAO copia bytes — o novo
 * documento so aponta pro mesmo `storageKey`. Gravado como `OperationLogDoc` com `beforeState: null`
 * pro asset novo, pra `undoLastOperation()` saber que desfazer significa apagar (nao restaurar).
 */
export async function duplicateMeshAsset(db: Db, session: Session, assetId: string) {
  const source = await getOwnedAsset(db, session, assetId);

  const now = new Date();
  const duplicate: MeshAssetDoc = {
    ...source,
    _id: new ObjectId(),
    name: `${source.name} (copia)`,
    // Pequeno deslocamento no eixo X pra nao ficar exatamente sobreposta a original (visibilidade
    // imediata de que a duplicata existe, sem exigir que o usuario mova pra descobrir).
    transform: {
      ...source.transform,
      position: [source.transform.position[0] + 20, source.transform.position[1], source.transform.position[2]],
    },
    linkedGroupId: null,
    syncVersion: 0,
    createdAt: now,
    updatedAt: now,
  };
  await assetsRepo.insertAsset(db, duplicate);

  const log: OperationLogDoc = {
    _id: new ObjectId(),
    ownerId: source.ownerId,
    caseId: source.caseId,
    sequence: await nextSequenceForCase(db, source.caseId),
    type: "duplicate",
    targetAssetIds: [duplicate._id],
    beforeState: { [duplicate._id.toHexString()]: null },
    afterState: { [duplicate._id.toHexString()]: { created: true } },
    syncVersionBefore: {},
    syncVersionAfter: { [duplicate._id.toHexString()]: 0 },
    userId: ObjectId.createFromHexString(session.userId),
    status: "committed",
    committedAt: now,
  };
  await collections.operationLogs(db).insertOne(log);

  return toPublicAsset(duplicate);
}

async function nextSequenceForCase(db: Db, caseId: ObjectId): Promise<number> {
  const [top] = await collections.operationLogs(db).find({ caseId }).sort({ sequence: -1 }).limit(1).toArray();
  return (top?.sequence ?? 0) + 1;
}

/**
 * Export sempre passa pela trava dura de licenca (`requireLicense` na rota) — mesmo que o cliente
 * tenha adulterado a checagem local de capability token, isso re-verifica ao vivo no servidor antes
 * de liberar os bytes do arquivo. Ver SECURITY.md, camada 4.
 */
export async function exportMeshAsset(db: Db, session: Session, assetId: string) {
  const asset = await getOwnedAsset(db, session, assetId);
  const buffer = await readMeshFile(asset.storageKey);
  return { asset, buffer };
}

export { deleteMeshFile };
