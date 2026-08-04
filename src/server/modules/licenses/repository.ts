import { Db, ObjectId } from "mongodb";

import { collections } from "@/server/db/collections";
import { LicenseDoc } from "@/server/db/schema";

export function findAllLicenses(db: Db) {
  return collections.licenses(db).find().sort({ createdAt: -1 }).toArray();
}

export function findLicenseById(db: Db, id: string) {
  return collections.licenses(db).findOne({ _id: ObjectId.createFromHexString(id) });
}

export function findActiveLicenseForUser(db: Db, userId: ObjectId) {
  return collections.licenses(db).findOne({ userId, status: "active", expiresAt: { $gt: new Date() } });
}

export function insertLicense(db: Db, license: LicenseDoc) {
  return collections.licenses(db).insertOne(license);
}

export function updateLicense(db: Db, id: string, patch: Partial<LicenseDoc>) {
  return collections
    .licenses(db)
    .findOneAndUpdate(
      { _id: ObjectId.createFromHexString(id) },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
}

export function touchHeartbeat(db: Db, id: ObjectId) {
  return collections.licenses(db).updateOne({ _id: id }, { $set: { lastHeartbeatAt: new Date() } });
}

/** Usado pelo job de varredura: flipa toda licenca ativa e vencida para "expired". */
export async function expireOverdueLicenses(db: Db): Promise<number> {
  const result = await collections.licenses(db).updateMany(
    { status: "active", expiresAt: { $lt: new Date() } },
    { $set: { status: "expired", updatedAt: new Date() } }
  );
  return result.modifiedCount;
}
