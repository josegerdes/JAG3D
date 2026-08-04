import { Db, ObjectId } from "mongodb";

import { ApiError } from "@/server/auth/guards";
import { hashPassword } from "@/server/auth/password";
import { UserDoc } from "@/server/db/schema";
import * as usersRepo from "@/server/modules/users/repository";
import { ChangePasswordInput, CreateUserInput, UpdateUserInput } from "@/server/modules/users/types";

export function toPublicUser(user: UserDoc) {
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    color: user.color,
    active: user.active,
    roleIds: user.roleIds.map((id) => id.toHexString()),
    createdAt: user.createdAt,
  };
}

export async function listUsers(db: Db) {
  const users = await usersRepo.findAllUsers(db);
  return users.map(toPublicUser);
}

export async function createUser(db: Db, input: CreateUserInput) {
  const existing = await usersRepo.findUserByEmail(db, input.email);
  if (existing) throw new ApiError(422, "Ja existe um usuario com este email");

  const now = new Date();
  const user: UserDoc = {
    _id: new ObjectId(),
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: await hashPassword(input.password),
    roleIds: input.roleIds.map((id) => ObjectId.createFromHexString(id)),
    color: input.color,
    active: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
  };
  await usersRepo.insertUser(db, user);
  return toPublicUser(user);
}

export async function updateUser(db: Db, userId: string, input: UpdateUserInput) {
  const patch: Partial<UserDoc> = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.color !== undefined && { color: input.color }),
    ...(input.active !== undefined && { active: input.active }),
    ...(input.roleIds !== undefined && { roleIds: input.roleIds.map((id) => ObjectId.createFromHexString(id)) }),
  };
  const updated = await usersRepo.updateUser(db, userId, patch);
  if (!updated) throw new ApiError(404, "Usuario nao encontrado");
  return toPublicUser(updated);
}

export async function changePassword(db: Db, userId: string, input: ChangePasswordInput) {
  const updated = await usersRepo.updateUser(db, userId, { passwordHash: await hashPassword(input.password) });
  if (!updated) throw new ApiError(404, "Usuario nao encontrado");
  return toPublicUser(updated);
}
