import { collections } from "@/server/db/collections";
import { registerBackfill } from "@/server/db/backfill";
import { enqueueJob } from "@/server/jobs/queue";
import { LICENSE_EXPIRY_SWEEP_JOB } from "@/server/modules/licenses/job-handler";

/** Garante que o job recorrente de varredura de expiracao de licenca esteja sempre agendado —
 *  idempotente (nao duplica se ja existe um pendente/em processamento). */
registerBackfill({
  version: "2024-license-sweep-seed",
  description: "Agenda o job recorrente license-expiry-sweep se nao houver nenhum pendente",
  async run(db) {
    const existing = await collections
      .jobs(db)
      .findOne({ type: LICENSE_EXPIRY_SWEEP_JOB, status: { $in: ["pending", "processing"] } });
    if (existing) return;
    await enqueueJob(db, LICENSE_EXPIRY_SWEEP_JOB, {});
  },
});
