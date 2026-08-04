import { Db, ObjectId } from "mongodb";

import { ApiError } from "@/server/auth/guards";
import { Session } from "@/server/auth/session";
import { MeshComparisonDoc } from "@/server/db/schema";
import { getCaseForSession } from "@/server/modules/cases/service";
import * as assetsRepo from "@/server/modules/mesh-assets/repository";
import * as comparisonsRepo from "@/server/modules/mesh-comparisons/repository";
import { CreateComparisonInput, SetAlignmentInput } from "@/server/modules/mesh-comparisons/types";

export function toPublicComparison(doc: MeshComparisonDoc) {
  return {
    id: doc._id.toHexString(),
    caseId: doc.caseId.toHexString(),
    beforeAssetId: doc.beforeAssetId.toHexString(),
    afterAssetId: doc.afterAssetId.toHexString(),
    alignmentTransform: doc.alignmentTransform,
  };
}

export async function listComparisonsForCase(db: Db, session: Session, caseId: string) {
  await getCaseForSession(db, session, caseId);
  const docs = await comparisonsRepo.findComparisonsByCase(db, ObjectId.createFromHexString(caseId));
  return docs.map(toPublicComparison);
}

/**
 * Cria um par antes/depois para o modo "Comparar" (harmonizacao facial — ver ARCHITECTURE.md).
 * `alignmentTransform` comeca null: os dois scans normalmente vem de sessoes diferentes e nao
 * compartilham referencial, entao o usuario precisa alinhar manualmente (N pontos) antes da
 * comparacao fazer sentido visualmente — ver `setAlignment`.
 */
export async function createComparison(db: Db, session: Session, input: CreateComparisonInput) {
  const caseDoc = await getCaseForSession(db, session, input.caseId);
  const beforeAssetId = ObjectId.createFromHexString(input.beforeAssetId);
  const afterAssetId = ObjectId.createFromHexString(input.afterAssetId);

  const [before, after] = await Promise.all([
    assetsRepo.findAssetById(db, input.beforeAssetId),
    assetsRepo.findAssetById(db, input.afterAssetId),
  ]);
  if (!before || !after) throw new ApiError(404, "Malha 'antes' ou 'depois' nao encontrada");
  if (!before.caseId.equals(caseDoc._id) || !after.caseId.equals(caseDoc._id)) {
    throw new ApiError(422, "As duas malhas precisam pertencer ao mesmo caso");
  }

  const now = new Date();
  const doc: MeshComparisonDoc = {
    _id: new ObjectId(),
    ownerId: caseDoc.ownerId,
    caseId: caseDoc._id,
    beforeAssetId,
    afterAssetId,
    alignmentTransform: null,
    createdAt: now,
    updatedAt: now,
  };
  await comparisonsRepo.insertComparison(db, doc);
  return toPublicComparison(doc);
}

export async function setAlignment(db: Db, session: Session, comparisonId: string, input: SetAlignmentInput) {
  const comparison = await comparisonsRepo.findComparisonById(db, comparisonId);
  if (!comparison) throw new ApiError(404, "Comparacao nao encontrada");
  await getCaseForSession(db, session, comparison.caseId.toHexString());

  const updated = await comparisonsRepo.updateComparison(db, comparisonId, {
    alignmentTransform: input.alignmentTransform,
  });
  if (!updated) throw new ApiError(404, "Comparacao nao encontrada");
  return toPublicComparison(updated);
}

export async function deleteComparison(db: Db, session: Session, comparisonId: string) {
  const comparison = await comparisonsRepo.findComparisonById(db, comparisonId);
  if (!comparison) throw new ApiError(404, "Comparacao nao encontrada");
  await getCaseForSession(db, session, comparison.caseId.toHexString());
  await comparisonsRepo.deleteComparison(db, comparisonId);
}
