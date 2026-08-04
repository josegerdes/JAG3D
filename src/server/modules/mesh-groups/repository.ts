import { Db, ObjectId } from "mongodb";

import { collections } from "@/server/db/collections";
import { MeshGroupDoc } from "@/server/db/schema";

export function findGroupsByCase(db: Db, caseId: ObjectId) {
  return collections.meshGroups(db).find({ caseId }).sort({ createdAt: 1 }).toArray();
}

export function findGroupById(db: Db, id: string) {
  return collections.meshGroups(db).findOne({ _id: ObjectId.createFromHexString(id) });
}

export function insertGroup(db: Db, doc: MeshGroupDoc) {
  return collections.meshGroups(db).insertOne(doc);
}

export function updateGroup(db: Db, id: string, patch: Partial<MeshGroupDoc>) {
  return collections
    .meshGroups(db)
    .findOneAndUpdate(
      { _id: ObjectId.createFromHexString(id) },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
}

export function deleteGroup(db: Db, id: string) {
  return collections.meshGroups(db).deleteOne({ _id: ObjectId.createFromHexString(id) });
}
