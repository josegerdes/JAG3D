import { registerJobHandler } from "@/server/jobs/handlers";
import * as licensesRepo from "@/server/modules/licenses/repository";

export const LICENSE_EXPIRY_SWEEP_JOB = "license-expiry-sweep";
const REPEAT_INTERVAL_MS = 60 * 60 * 1000; // 1h

/**
 * Varre licencas ativas vencidas e flipa para "expired" — mantem listagens/consistencia corretas
 * em vez de depender so de comparacao lazy de `expiresAt` em cada leitura. Reagenda a si mesmo no
 * fim de cada execucao (import-por-efeito-colateral em `worker.ts` garante que isso roda uma vez
 * por processo).
 */
registerJobHandler(LICENSE_EXPIRY_SWEEP_JOB, async (db) => {
  const count = await licensesRepo.expireOverdueLicenses(db);
  if (count > 0) console.log(`[license-expiry-sweep] ${count} licenca(s) marcada(s) como expirada(s)`);

  const { enqueueJob } = await import("@/server/jobs/queue");
  await enqueueJob(db, LICENSE_EXPIRY_SWEEP_JOB, {}, { runAt: new Date(Date.now() + REPEAT_INTERVAL_MS) });
});
