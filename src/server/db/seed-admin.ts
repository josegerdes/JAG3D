import { ObjectId, Db } from "mongodb";

import { collections } from "@/server/db/collections";
import { hashPassword } from "@/server/auth/password";
import { ALL_PERMISSIONS } from "@/server/rbac/permissions";

/**
 * Cria a role Administrador + o usuario administrador inicial se ainda nao
 * existir nenhum usuario. Idempotente — seguro de chamar toda vez que o
 * processo sobe (chamado de `instrumentation.ts`, ja que a imagem Docker usa
 * `output: "standalone"` do Next e nao inclui `tsx`/arquivos fonte, entao
 * `npm run seed` nao existe dentro do container publicado).
 */
export async function seedInitialAdmin(db: Db): Promise<void> {
  const userCount = await collections.users(db).countDocuments();
  if (userCount > 0) {
    console.log("[seed] Ignorado: ja existem usuarios.");
    return;
  }

  const now = new Date();
  const adminRole = {
    _id: new ObjectId(),
    name: "Administrador",
    color: "#5865F2",
    position: 1,
    permissions: ALL_PERMISSIONS,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
  await collections.roles(db).insertOne(adminRole);

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@jag3d.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";

  const adminUserId = new ObjectId();
  await collections.users(db).insertOne({
    _id: adminUserId,
    name: "Administrador",
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    roleIds: [adminRole._id],
    color: "#5865F2",
    active: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
  });

  // Admin ja nasce com uma licenca ativa de longa duracao, senao nao consegue nem testar o
  // proprio sistema que acabou de instalar.
  await collections.licenses(db).insertOne({
    _id: new ObjectId(),
    userId: adminUserId,
    plan: "admin",
    status: "active",
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    issuedByAdminId: adminUserId,
    revokedAt: null,
    revokedReason: null,
    lastHeartbeatAt: null,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`[seed] Usuario administrador criado: ${email} / ${password}`);
  console.log("[seed] Troque a senha assim que possivel.");
}
