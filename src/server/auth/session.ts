import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import { connectDB } from "@/server/db/client";
import { collections } from "@/server/db/collections";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/server/auth/jwt";

export interface Session {
  userId: string;
  name: string;
  email: string;
  color: string;
  roleIds: string[];
  permissions: Set<string>;
  /** true se o usuario tem a role padrao "Administrador" (`isDefault`, criada no seed). */
  isSuperAdmin: boolean;
  /** Computado ao vivo contra `LicenseDoc` a cada request — nunca cacheado num claim de token. */
  hasActiveLicense: boolean;
}

/**
 * Resolve a sessao a partir do cookie a cada request, buscando roles e o
 * status de licenca no banco (nunca confia em claims embutidos no JWT) —
 * assim revogar uma role ou uma licenca tem efeito imediato, sem esperar o
 * token de sessao expirar.
 */
export async function getSession(): Promise<Session | null> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyAuthToken(token);
  if (!payload) return null;

  const db = await connectDB();
  const userId = ObjectId.createFromHexString(payload.userId);
  const user = await collections.users(db).findOne({ _id: userId, active: true });
  if (!user) return null;

  const roles = await collections
    .roles(db)
    .find({ _id: { $in: user.roleIds } })
    .toArray();

  const permissions = new Set<string>();
  let isSuperAdmin = false;
  for (const role of roles) {
    for (const permission of role.permissions) {
      permissions.add(permission);
    }
    if (role.isDefault) isSuperAdmin = true;
  }

  const now = new Date();
  const activeLicense = await collections.licenses(db).findOne({
    userId,
    status: "active",
    expiresAt: { $gt: now },
  });

  return {
    userId: user._id.toHexString(),
    name: user.name,
    email: user.email,
    color: user.color,
    roleIds: user.roleIds.map((id) => id.toHexString()),
    permissions,
    isSuperAdmin,
    hasActiveLicense: Boolean(activeLicense),
  };
}
