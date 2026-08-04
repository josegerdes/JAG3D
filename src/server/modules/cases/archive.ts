import JSZip from "jszip";
import { Db, ObjectId } from "mongodb";

import { ApiError } from "@/server/auth/guards";
import { Session } from "@/server/auth/session";
import { collections } from "@/server/db/collections";
import { CaseDoc, MeshAssetDoc, MeshComparisonDoc, MeshGroupDoc, identityTransform } from "@/server/db/schema";
import { getCaseForSession } from "@/server/modules/cases/service";
import * as assetsRepo from "@/server/modules/mesh-assets/repository";
import * as groupsRepo from "@/server/modules/mesh-groups/repository";
import * as comparisonsRepo from "@/server/modules/mesh-comparisons/repository";
import { checksumOf, readMeshFile, saveMeshFile, storageKeyFor } from "@/server/modules/mesh-assets/storage";
import { sniffMeshFormat } from "@/server/modules/mesh-assets/format-sniff";

/**
 * O caso inteiro (metadados + TODOS os bytes de malha reais) empacotado num .zip portatil — a
 * alternativa que o usuario escolheu a "so o cliente e fonte de verdade" (que arriscava perder
 * dados se o navegador limpasse o storage local): em vez disso, o usuario pode baixar um backup
 * completo e restauravel a qualquer momento, sem depender so do armazenamento do servidor
 * continuar intacto pra sempre. Formato: `manifest.json` (relacoes por indice, nao por ObjectId —
 * IDs sao regenerados na importacao) + `meshes/<indice>.<formato>` com os bytes crus de cada malha.
 */
interface ArchiveManifest {
  version: 1;
  case: { name: string; patientRef: string | null };
  assets: Array<{
    index: number;
    name: string;
    format: string;
    transform: MeshAssetDoc["transform"];
    groupIndex: number | null;
    linkedGroupIndex: number | null;
  }>;
  groups: Array<{
    index: number;
    name: string;
    memberIndices: number[];
    groupTransform: MeshGroupDoc["groupTransform"];
    visible: boolean;
    locked: boolean;
  }>;
  comparisons: Array<{
    beforeIndex: number;
    afterIndex: number;
    alignmentTransform: MeshComparisonDoc["alignmentTransform"];
  }>;
}

export async function exportCaseArchive(db: Db, session: Session, caseId: string): Promise<{ buffer: Buffer; filename: string }> {
  const caseDoc = await getCaseForSession(db, session, caseId);
  const caseObjectId = caseDoc._id;

  const assets = await assetsRepo.findAssetsByCase(db, caseObjectId);
  const groups = await groupsRepo.findGroupsByCase(db, caseObjectId);
  const comparisons = await comparisonsRepo.findComparisonsByCase(db, caseObjectId);

  const assetIndexById = new Map(assets.map((a, i) => [a._id.toHexString(), i]));
  const groupIndexById = new Map(groups.map((g, i) => [g._id.toHexString(), i]));

  const zip = new JSZip();
  const manifest: ArchiveManifest = {
    version: 1,
    case: { name: caseDoc.name, patientRef: caseDoc.patientRef },
    assets: assets.map((asset, index) => ({
      index,
      name: asset.name,
      format: asset.format,
      transform: asset.transform,
      groupIndex: asset.groupId ? (groupIndexById.get(asset.groupId.toHexString()) ?? null) : null,
      linkedGroupIndex: asset.linkedGroupId ? (groupIndexById.get(asset.linkedGroupId.toHexString()) ?? null) : null,
    })),
    groups: groups.map((group, index) => ({
      index,
      name: group.name,
      memberIndices: group.meshAssetIds.map((id) => assetIndexById.get(id.toHexString())).filter((i): i is number => i !== undefined),
      groupTransform: group.groupTransform,
      visible: group.visible,
      locked: group.locked,
    })),
    comparisons: comparisons
      .map((comparison) => ({
        beforeIndex: assetIndexById.get(comparison.beforeAssetId.toHexString()),
        afterIndex: assetIndexById.get(comparison.afterAssetId.toHexString()),
        alignmentTransform: comparison.alignmentTransform,
      }))
      .filter((c): c is { beforeIndex: number; afterIndex: number; alignmentTransform: MeshComparisonDoc["alignmentTransform"] } =>
        c.beforeIndex !== undefined && c.afterIndex !== undefined
      ),
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  for (const [index, asset] of assets.entries()) {
    const bytes = await readMeshFile(asset.storageKey);
    zip.file(`meshes/${index}.${asset.format}`, bytes);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const safeName = caseDoc.name.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 60) || "caso";
  return { buffer, filename: `jag3d-${safeName}.zip` };
}

export async function importCaseArchive(db: Db, session: Session, zipBuffer: Buffer): Promise<CaseDoc> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    throw new ApiError(422, "Arquivo .zip invalido ou corrompido");
  }

  const manifestEntry = zip.file("manifest.json");
  if (!manifestEntry) throw new ApiError(422, "manifest.json ausente no .zip — nao e um projeto JAG3D valido");
  const manifest = JSON.parse(await manifestEntry.async("string")) as ArchiveManifest;
  if (manifest.version !== 1) throw new ApiError(422, `Versao de manifesto nao suportada: ${manifest.version}`);

  const now = new Date();
  const ownerId = ObjectId.createFromHexString(session.userId);

  const caseDoc: CaseDoc = {
    _id: new ObjectId(),
    ownerId,
    name: `${manifest.case.name} (importado)`,
    patientRef: manifest.case.patientRef,
    status: "draft",
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  await collections.cases(db).insertOne(caseDoc);

  // Assets primeiro (sem groupId/linkedGroupId ainda — resolvidos depois que os grupos existirem).
  const newAssetIds: ObjectId[] = [];
  for (const assetManifest of manifest.assets) {
    const entry = zip.file(`meshes/${assetManifest.index}.${assetManifest.format}`);
    if (!entry) throw new ApiError(422, `Arquivo de malha ausente no .zip pro indice ${assetManifest.index}`);
    const bytes = Buffer.from(await entry.async("nodebuffer"));
    const { format, triangleCount } = sniffMeshFormat(bytes, assetManifest.name);
    const checksumSha256 = checksumOf(bytes);
    const storageKey = storageKeyFor(checksumSha256, format);
    await saveMeshFile(storageKey, bytes);

    const newAsset: MeshAssetDoc = {
      _id: new ObjectId(),
      ownerId,
      caseId: caseDoc._id,
      groupId: null,
      name: assetManifest.name,
      format,
      storageKey,
      checksumSha256,
      sizeBytes: bytes.length,
      triangleCount,
      transform: assetManifest.transform ?? identityTransform(),
      linkedGroupId: null,
      syncVersion: 0,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await collections.meshAssets(db).insertOne(newAsset);
    newAssetIds.push(newAsset._id);
  }

  const newGroupIds: ObjectId[] = [];
  for (const groupManifest of manifest.groups) {
    const memberIds = groupManifest.memberIndices.map((i) => newAssetIds[i]).filter((id): id is ObjectId => Boolean(id));
    const newGroup: MeshGroupDoc = {
      _id: new ObjectId(),
      ownerId,
      caseId: caseDoc._id,
      name: groupManifest.name,
      meshAssetIds: memberIds,
      groupTransform: groupManifest.groupTransform ?? identityTransform(),
      visible: groupManifest.visible,
      locked: groupManifest.locked,
      syncVersion: 0,
      createdAt: now,
      updatedAt: now,
    };
    await collections.meshGroups(db).insertOne(newGroup);
    newGroupIds.push(newGroup._id);
    await collections.meshAssets(db).updateMany({ _id: { $in: memberIds } }, { $set: { groupId: newGroup._id } });
  }

  for (const assetManifest of manifest.assets) {
    if (assetManifest.linkedGroupIndex === null) continue;
    const linkedGroupId = newGroupIds[assetManifest.linkedGroupIndex];
    const assetId = newAssetIds[assetManifest.index];
    if (linkedGroupId && assetId) {
      await collections.meshAssets(db).updateOne({ _id: assetId }, { $set: { linkedGroupId } });
    }
  }

  for (const comparisonManifest of manifest.comparisons) {
    const beforeAssetId = newAssetIds[comparisonManifest.beforeIndex];
    const afterAssetId = newAssetIds[comparisonManifest.afterIndex];
    if (!beforeAssetId || !afterAssetId) continue;
    const newComparison: MeshComparisonDoc = {
      _id: new ObjectId(),
      ownerId,
      caseId: caseDoc._id,
      beforeAssetId,
      afterAssetId,
      alignmentTransform: comparisonManifest.alignmentTransform,
      createdAt: now,
      updatedAt: now,
    };
    await collections.meshComparisons(db).insertOne(newComparison);
  }

  return caseDoc;
}
