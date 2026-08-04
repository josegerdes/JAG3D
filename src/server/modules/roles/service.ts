import { Db, ObjectId } from "mongodb";

import { RoleDoc } from "@/server/db/schema";
import { ApiError } from "@/server/auth/guards";
import * as rolesRepo from "@/server/modules/roles/repository";
import { CreateRoleInput, ReorderRolesInput, UpdateRoleInput } from "@/server/modules/roles/types";
import { ALL_PERMISSIONS } from "@/server/rbac/permissions";

/** A role padrao (Administrador) sempre tem TODAS as permissoes, mesmo as adicionadas depois que
 *  ela foi criada — calculado na hora a partir do catalogo atual, nao do array salvo, senao toda
 *  permissao nova exigiria um toggle manual em cada instalacao existente. */
export function toPublicRole(role: RoleDoc) {
  return {
    id: role._id.toHexString(),
    name: role.name,
    color: role.color,
    position: role.position,
    permissions: role.isDefault ? ALL_PERMISSIONS : role.permissions,
    isDefault: role.isDefault,
  };
}

export async function listRoles(db: Db) {
  const roles = await rolesRepo.findAllRoles(db);
  return roles.map(toPublicRole);
}

export async function createRole(db: Db, input: CreateRoleInput) {
  const now = new Date();
  const role: RoleDoc = {
    _id: new ObjectId(),
    name: input.name,
    color: input.color,
    position: await rolesRepo.nextPosition(db),
    permissions: input.permissions,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  await rolesRepo.insertRole(db, role);
  return toPublicRole(role);
}

export async function updateRole(db: Db, roleId: string, input: UpdateRoleInput) {
  const role = await rolesRepo.findRoleById(db, roleId);
  if (!role) throw new ApiError(404, "Role nao encontrada");

  const patch: Partial<RoleDoc> = { ...input };
  // O Administrador tem sempre todas as permissoes (calculado em `toPublicRole`) — gravar um
  // subconjunto que nunca vai ser respeitado nao faz sentido, entao a tentativa e ignorada.
  if (role.isDefault) delete patch.permissions;

  const updated = await rolesRepo.updateRole(db, roleId, patch);
  if (!updated) throw new ApiError(404, "Role nao encontrada");
  return toPublicRole(updated);
}

/** Copia de uma role existente — nunca marcada `isDefault`, mesmo duplicando o Administrador, pra
 *  nao criar uma segunda role protegida contra exclusao. */
export async function duplicateRole(db: Db, roleId: string) {
  const role = await rolesRepo.findRoleById(db, roleId);
  if (!role) throw new ApiError(404, "Role nao encontrada");

  const now = new Date();
  const duplicate: RoleDoc = {
    _id: new ObjectId(),
    name: `${role.name} (copia)`,
    color: role.color,
    position: await rolesRepo.nextPosition(db),
    permissions: toPublicRole(role).permissions,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  await rolesRepo.insertRole(db, duplicate);
  return toPublicRole(duplicate);
}

export async function deleteRole(db: Db, roleId: string) {
  const role = await rolesRepo.findRoleById(db, roleId);
  if (!role) throw new ApiError(404, "Role nao encontrada");
  if (role.isDefault) throw new ApiError(422, "A role Administrador nao pode ser excluida");
  await rolesRepo.pullRoleFromAllUsers(db, roleId);
  await rolesRepo.deleteRole(db, roleId);
}

export async function reorderRoles(db: Db, input: ReorderRolesInput) {
  await rolesRepo.setPositions(db, input.orderedIds);
  return listRoles(db);
}
