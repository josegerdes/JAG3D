import { Db, ObjectId } from "mongodb";

import { ApiError } from "@/server/auth/guards";
import { Session } from "@/server/auth/session";
import { CaseDoc } from "@/server/db/schema";
import * as casesRepo from "@/server/modules/cases/repository";
import { CreateCaseInput, UpdateCaseInput } from "@/server/modules/cases/types";

export function toPublicCase(caseDoc: CaseDoc) {
  return {
    id: caseDoc._id.toHexString(),
    ownerId: caseDoc.ownerId.toHexString(),
    name: caseDoc.name,
    patientRef: caseDoc.patientRef,
    status: caseDoc.status,
    createdAt: caseDoc.createdAt,
    updatedAt: caseDoc.updatedAt,
  };
}

export async function listMyCases(db: Db, session: Session) {
  const cases = await casesRepo.findCasesByOwner(db, ObjectId.createFromHexString(session.userId));
  return cases.map(toPublicCase);
}

export async function getCaseForSession(db: Db, session: Session, caseId: string) {
  const caseDoc = await casesRepo.findCaseById(db, caseId);
  if (!caseDoc) throw new ApiError(404, "Caso nao encontrado");
  if (!caseDoc.ownerId.equals(ObjectId.createFromHexString(session.userId)) && !session.permissions.has("cases.manageAny")) {
    throw new ApiError(403, "Voce nao tem acesso a este caso");
  }
  return caseDoc;
}

export async function createCase(db: Db, session: Session, input: CreateCaseInput) {
  const now = new Date();
  const caseDoc: CaseDoc = {
    _id: new ObjectId(),
    ownerId: ObjectId.createFromHexString(session.userId),
    name: input.name,
    patientRef: input.patientRef ?? null,
    status: "draft",
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  await casesRepo.insertCase(db, caseDoc);
  return toPublicCase(caseDoc);
}

export async function updateCase(db: Db, session: Session, caseId: string, input: UpdateCaseInput) {
  await getCaseForSession(db, session, caseId);
  const updated = await casesRepo.updateCase(db, caseId, input);
  if (!updated) throw new ApiError(404, "Caso nao encontrado");
  return toPublicCase(updated);
}

export async function deleteCase(db: Db, session: Session, caseId: string) {
  await getCaseForSession(db, session, caseId);
  await casesRepo.softDeleteCase(db, caseId);
}
