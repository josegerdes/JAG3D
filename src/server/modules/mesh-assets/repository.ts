import { Db, ObjectId } from "mongodb";

import { collections } from "@/server/db/collections";
import { MeshAssetDoc } from "@/server/db/schema";

export function findAssetsByCase(db: Db, caseId: ObjectId) {
  return collections.meshAssets(db).find({ caseId, deleted: false }).sort({ createdAt: 1 }).toArray();
}

export function findAssetById(db: Db, id: string) {
  return collections.meshAssets(db).findOne({ _id: ObjectId.createFromHexString(id), deleted: false });
}

export function findAssetsByIds(db: Db, ids: ObjectId[]) {
  return collections.meshAssets(db).find({ _id: { $in: ids }, deleted: false }).toArray();
}

/** Toda malha vinculada ao mesmo conjunto rigido — usado pra aplicar delta de transform junto (anti-dessincronizacao). */
export function findLinkedSiblings(db: Db, linkedGroupId: ObjectId, excludeId?: ObjectId) {
  return collections
    .meshAssets(db)
    .find({ linkedGroupId, deleted: false, ...(excludeId && { _id: { $ne: excludeId } }) })
    .toArray();
}

export function insertAsset(db: Db, doc: MeshAssetDoc) {
  return collections.meshAssets(db).insertOne(doc);
}

export function updateAsset(db: Db, id: string, patch: Partial<MeshAssetDoc>) {
  return collections
    .meshAssets(db)
    .findOneAndUpdate(
      { _id: ObjectId.createFromHexString(id) },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
}

export function softDeleteAsset(db: Db, id: string) {
  return collections
    .meshAssets(db)
    .updateOne({ _id: ObjectId.createFromHexString(id) }, { $set: { deleted: true, updatedAt: new Date() } });
}
