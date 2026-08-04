import { Db, ObjectId } from "mongodb";

import { ApiError } from "@/server/auth/guards";
import { LicenseDoc } from "@/server/db/schema";
import * as licensesRepo from "@/server/modules/licenses/repository";
import { ExtendLicenseInput, IssueLicenseInput, RevokeLicenseInput } from "@/server/modules/licenses/types";
import { signCapabilityToken } from "@/server/crypto/capability-token";

export function toPublicLicense(license: LicenseDoc) {
  return {
    id: license._id.toHexString(),
    userId: license.userId.toHexString(),
    plan: license.plan,
    status: license.status,
    issuedAt: license.issuedAt,
    expiresAt: license.expiresAt,
    revokedAt: license.revokedAt,
    revokedReason: license.revokedReason,
    lastHeartbeatAt: license.lastHeartbeatAt,
  };
}

export async function listLicenses(db: Db) {
  const licenses = await licensesRepo.findAllLicenses(db);
  return licenses.map(toPublicLicense);
}

export async function issueLicense(db: Db, adminUserId: string, input: IssueLicenseInput) {
  const now = new Date();
  const license: LicenseDoc = {
    _id: new ObjectId(),
    userId: ObjectId.createFromHexString(input.userId),
    plan: input.plan,
    status: "active",
    issuedAt: now,
    expiresAt: input.expiresAt,
    issuedByAdminId: ObjectId.createFromHexString(adminUserId),
    revokedAt: null,
    revokedReason: null,
    lastHeartbeatAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await licensesRepo.insertLicense(db, license);
  return toPublicLicense(license);
}

export async function extendLicense(db: Db, licenseId: string, input: ExtendLicenseInput) {
  const updated = await licensesRepo.updateLicense(db, licenseId, {
    expiresAt: input.expiresAt,
    status: "active",
    revokedAt: null,
    revokedReason: null,
  });
  if (!updated) throw new ApiError(404, "Licenca nao encontrada");
  return toPublicLicense(updated);
}

export async function revokeLicense(db: Db, licenseId: string, input: RevokeLicenseInput) {
  const updated = await licensesRepo.updateLicense(db, licenseId, {
    status: "revoked",
    revokedAt: new Date(),
    revokedReason: input.reason ?? null,
  });
  if (!updated) throw new ApiError(404, "Licenca nao encontrada");
  return toPublicLicense(updated);
}

/**
 * Emite um capability token novo se o usuario tiver licenca ativa agora — chamado no login e no
 * heartbeat periodico. Retorna null (nunca lanca) se nao houver licenca ativa: a ausencia de token
 * novo e o proprio sinal de "licenca nao ativa" para o cliente, sem expor detalhes por que.
 */
export async function issueCapabilityTokenIfLicensed(db: Db, userId: string): Promise<string | null> {
  const userObjectId = ObjectId.createFromHexString(userId);
  const license = await licensesRepo.findActiveLicenseForUser(db, userObjectId);
  if (!license) return null;

  await licensesRepo.touchHeartbeat(db, license._id);
  return signCapabilityToken({ licenseId: license._id.toHexString(), userId });
}
