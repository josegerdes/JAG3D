import { ObjectId } from "mongodb";

import { Session } from "@/server/auth/session";
import { CaseDoc } from "@/server/db/schema";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function requireAuth(session: Session | null): Session {
  if (!session) throw new ApiError(401, "Nao autenticado");
  return session;
}

export function requirePermission(session: Session, permission: string): void {
  if (!session.permissions.has(permission)) {
    throw new ApiError(403, `Permissao necessaria: ${permission}`);
  }
}

/** Gate exclusivo administrativo — role padrao "Administrador" (`isDefault`), nao uma permissao togavel. */
export function requireSuperAdmin(session: Session): void {
  if (!session.isSuperAdmin) {
    throw new ApiError(403, "So o administrador geral pode acessar isso");
  }
}

/** Licenca ativa e valida — checagem feita ao vivo em `getSession()`, nao a partir de um token em cache. */
export function requireActiveLicense(session: Session): void {
  if (!session.hasActiveLicense) {
    throw new ApiError(402, "Licenca inativa ou expirada");
  }
}

/**
 * Acesso a caso/malha e por posse (`ownerId`), nao por unidade — substitui o
 * `requireUnitAccess` do padrao de RBAC por unidade. `manageAny` (permissao
 * administrativa) e o unico jeito de acessar dado de outro usuario.
 */
export function requireCaseOwnership(session: Session, caseDoc: Pick<CaseDoc, "ownerId">): void {
  if (caseDoc.ownerId.equals(ObjectId.createFromHexString(session.userId))) return;
  if (session.permissions.has("cases.manageAny")) return;
  throw new ApiError(403, "Voce nao tem acesso a este caso");
}
