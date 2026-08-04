import { Db, ObjectId } from "mongodb";

import { collections } from "@/server/db/collections";
import { UserDoc } from "@/server/db/schema";

export function findAllUsers(db: Db) {
  return collections.users(db).find().sort({ createdAt: -1 }).toArray();
}

export function findUserById(db: Db, id: string) {
  return collections.users(db).findOne({ _id: ObjectId.createFromHexString(id) });
}

export function findUserByEmail(db: Db, email: string) {
  return collections.users(db).findOne({ email: email.toLowerCase() });
}

export function insertUser(db: Db, user: UserDoc) {
  return collections.users(db).insertOne(user);
}

export function updateUser(db: Db, id: string, patch: Partial<UserDoc>) {
  return collections
    .users(db)
    .findOneAndUpdate(
      { _id: ObjectId.createFromHexString(id) },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
}
