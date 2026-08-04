import { Db, ObjectId } from "mongodb";

import { collections } from "@/server/db/collections";
import { CaseDoc } from "@/server/db/schema";

export function findCasesByOwner(db: Db, ownerId: ObjectId) {
  return collections.cases(db).find({ ownerId, deleted: false }).sort({ updatedAt: -1 }).toArray();
}

export function findCaseById(db: Db, id: string) {
  return collections.cases(db).findOne({ _id: ObjectId.createFromHexString(id), deleted: false });
}

export function insertCase(db: Db, doc: CaseDoc) {
  return collections.cases(db).insertOne(doc);
}

export function updateCase(db: Db, id: string, patch: Partial<CaseDoc>) {
  return collections
    .cases(db)
    .findOneAndUpdate(
      { _id: ObjectId.createFromHexString(id) },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
}

export function softDeleteCase(db: Db, id: string) {
  return collections
    .cases(db)
    .updateOne({ _id: ObjectId.createFromHexString(id) }, { $set: { deleted: true, updatedAt: new Date() } });
}
