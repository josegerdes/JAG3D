import { Db, ObjectId } from "mongodb";

import { collections } from "@/server/db/collections";
import { MeshComparisonDoc } from "@/server/db/schema";

export function findComparisonsByCase(db: Db, caseId: ObjectId) {
  return collections.meshComparisons(db).find({ caseId }).sort({ createdAt: -1 }).toArray();
}

export function findComparisonById(db: Db, id: string) {
  return collections.meshComparisons(db).findOne({ _id: ObjectId.createFromHexString(id) });
}

export function insertComparison(db: Db, doc: MeshComparisonDoc) {
  return collections.meshComparisons(db).insertOne(doc);
}

export function updateComparison(db: Db, id: string, patch: Partial<MeshComparisonDoc>) {
  return collections
    .meshComparisons(db)
    .findOneAndUpdate(
      { _id: ObjectId.createFromHexString(id) },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
}

export function deleteComparison(db: Db, id: string) {
  return collections.meshComparisons(db).deleteOne({ _id: ObjectId.createFromHexString(id) });
}
