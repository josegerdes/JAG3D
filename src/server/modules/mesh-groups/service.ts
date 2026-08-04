import { Db, ObjectId } from "mongodb";

import { ApiError } from "@/server/auth/guards";
import { Session } from "@/server/auth/session";
import { identityTransform, MeshGroupDoc } from "@/server/db/schema";
import { getCaseForSession } from "@/server/modules/cases/service";
import * as groupsRepo from "@/server/modules/mesh-groups/repository";
import * as assetsRepo from "@/server/modules/mesh-assets/repository";
import { toPublicAsset } from "@/server/modules/mesh-assets/service";
import { CreateGroupInput, UpdateGroupInput } from "@/server/modules/mesh-groups/types";

export function toPublicGroup(doc: MeshGroupDoc) {
  return {
    id: doc._id.toHexString(),
    caseId: doc.caseId.toHexString(),
    name: doc.name,
    meshAssetIds: doc.meshAssetIds.map((id) => id.toHexString()),
    groupTransform: doc.groupTransform,
    visible: doc.visible,
    locked: doc.locked,
    syncVersion: doc.syncVersion,
  };
}

export async function listGroupsForCase(db: Db, session: Session, caseId: string) {
  await getCaseForSession(db, session, caseId);
  const groups = await groupsRepo.findGroupsByCase(db, ObjectId.createFromHexString(caseId));
  return groups.map(toPublicGroup);
}

/** Agrupar: cria o `MeshGroupDoc` e aponta o `groupId` de cada malha selecionada pra ele — nao mexe
 *  em `linkedGroupId`/transform individual (agrupar e organizacao visual; vincular, feito a parte,
 *  e o que aciona o delta compartilhado de movimento no anti-dessincronizacao). */
export async function groupMeshes(db: Db, session: Session, input: CreateGroupInput) {
  const caseDoc = await getCaseForSession(db, session, input.caseId);
  const assetIds = input.meshAssetIds.map((id) => ObjectId.createFromHexString(id));
  const assets = await assetsRepo.findAssetsByIds(db, assetIds);
  if (assets.length !== assetIds.length) throw new ApiError(404, "Uma ou mais malhas nao foram encontradas");
  for (const asset of assets) {
    if (!asset.caseId.equals(caseDoc._id)) throw new ApiError(422, "Todas as malhas devem pertencer ao mesmo caso");
  }

  const now = new Date();
  const group: MeshGroupDoc = {
    _id: new ObjectId(),
    ownerId: caseDoc.ownerId,
    caseId: caseDoc._id,
    name: input.name,
    meshAssetIds: assetIds,
    groupTransform: identityTransform(),
    visible: true,
    locked: false,
    syncVersion: 0,
    createdAt: now,
    updatedAt: now,
  };
  await groupsRepo.insertGroup(db, group);
  await Promise.all(assetIds.map((id) => assetsRepo.updateAsset(db, id.toHexString(), { groupId: group._id })));
  return toPublicGroup(group);
}

export async function ungroup(db: Db, session: Session, groupId: string) {
  const group = await groupsRepo.findGroupById(db, groupId);
  if (!group) throw new ApiError(404, "Grupo nao encontrado");
  await getCaseForSession(db, session, group.caseId.toHexString());

  await Promise.all(group.meshAssetIds.map((id) => assetsRepo.updateAsset(db, id.toHexString(), { groupId: null })));
  await groupsRepo.deleteGroup(db, groupId);
}

export async function updateGroup(db: Db, session: Session, groupId: string, input: UpdateGroupInput) {
  const group = await groupsRepo.findGroupById(db, groupId);
  if (!group) throw new ApiError(404, "Grupo nao encontrado");
  await getCaseForSession(db, session, group.caseId.toHexString());

  const updated = await groupsRepo.updateGroup(db, groupId, input);
  if (!updated) throw new ApiError(404, "Grupo nao encontrado");
  return toPublicGroup(updated);
}

export async function listGroupMembers(db: Db, session: Session, groupId: string) {
  const group = await groupsRepo.findGroupById(db, groupId);
  if (!group) throw new ApiError(404, "Grupo nao encontrado");
  await getCaseForSession(db, session, group.caseId.toHexString());
  const assets = await assetsRepo.findAssetsByIds(db, group.meshAssetIds);
  return assets.map(toPublicAsset);
}
