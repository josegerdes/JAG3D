import { Db, ObjectId } from "mongodb";

import { collections } from "@/server/db/collections";
import { RoleDoc } from "@/server/db/schema";

export function findAllRoles(db: Db) {
  return collections.roles(db).find().sort({ position: -1 }).toArray();
}

export function findRolesByIds(db: Db, ids: ObjectId[]) {
  return collections.roles(db).find({ _id: { $in: ids } }).toArray();
}

export function findRoleById(db: Db, id: string) {
  return collections.roles(db).findOne({ _id: ObjectId.createFromHexString(id) });
}

export async function nextPosition(db: Db): Promise<number> {
  const top = await collections.roles(db).find().sort({ position: -1 }).limit(1).toArray();
  return (top[0]?.position ?? 0) + 1;
}

export function insertRole(db: Db, role: RoleDoc) {
  return collections.roles(db).insertOne(role);
}

export function updateRole(db: Db, id: string, patch: Partial<RoleDoc>) {
  return collections
    .roles(db)
    .findOneAndUpdate(
      { _id: ObjectId.createFromHexString(id) },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
}

export function deleteRole(db: Db, id: string) {
  return collections.roles(db).deleteOne({ _id: ObjectId.createFromHexString(id) });
}

export async function setPositions(db: Db, orderedIds: string[]) {
  const total = orderedIds.length;
  await Promise.all(
    orderedIds.map((id, index) =>
      collections
        .roles(db)
        .updateOne({ _id: ObjectId.createFromHexString(id) }, { $set: { position: total - index, updatedAt: new Date() } })
    )
  );
}

export function pullRoleFromAllUsers(db: Db, roleId: string) {
  return collections
    .users(db)
    .updateMany({}, { $pull: { roleIds: ObjectId.createFromHexString(roleId) } });
}
