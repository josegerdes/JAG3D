import { ObjectId } from "mongodb";

import { collections } from "@/server/db/collections";
import { registerBackfill } from "@/server/db/backfill";

/**
 * Bug real ja visto em producao: um deploy anterior a este backfill criou o usuario admin sem
 * licenca (a emissao automatica de licenca no seed foi adicionada depois) — como `seedInitialAdmin`
 * so roda se `users` estiver vazio, esse admin ficava PARA SEMPRE sem licenca ativa, mesmo apos
 * redeploys, porque o guard de "so roda uma vez" nunca deixava o seed rodar de novo. Mesmo padrao
 * recorrente desta linhagem de projetos: campo/registro novo nunca se aplica retroativamente a
 * documentos ja existentes — precisa de backfill em boot, nao so no seed inicial.
 */
registerBackfill({
  version: "2024-ensure-admin-license",
  description: "Garante que todo usuario com a role isDefault (Administrador) tenha uma licenca ativa",
  async run(db) {
    const adminRoles = await collections.roles(db).find({ isDefault: true }).toArray();
    if (adminRoles.length === 0) return;
    const adminRoleIds = adminRoles.map((role) => role._id);

    const adminUsers = await collections
      .users(db)
      .find({ roleIds: { $in: adminRoleIds }, active: true })
      .toArray();

    const now = new Date();
    for (const user of adminUsers) {
      const activeLicense = await collections.licenses(db).findOne({
        userId: user._id,
        status: "active",
        expiresAt: { $gt: now },
      });
      if (activeLicense) continue;

      await collections.licenses(db).insertOne({
        _id: new ObjectId(),
        userId: user._id,
        plan: "admin",
        status: "active",
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        issuedByAdminId: user._id,
        revokedAt: null,
        revokedReason: null,
        lastHeartbeatAt: null,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`[backfill] Licenca de administrador emitida para ${user.email}`);
    }
  },
});
