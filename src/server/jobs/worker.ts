import { connectDB } from "@/server/db/client";
import { claimNextJob, completeJob, failJob } from "@/server/jobs/queue";
import { HANDLERS } from "@/server/jobs/handlers";
// Handlers se registram via import-por-efeito-colateral — precisa vir depois do registry pra nao dar ciclo.
import "@/server/modules/licenses/job-handler";

const POLL_INTERVAL_MS = 3_000;

async function processOnce() {
  const db = await connectDB();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await claimNextJob(db);
    if (!job) break;

    const handler = HANDLERS[job.type];
    try {
      if (!handler) throw new Error(`Nenhum handler registrado para o job "${job.type}"`);
      await handler(db, job.payload);
      await completeJob(db, job._id);
    } catch (error) {
      console.error(`[jobs] falha ao processar job ${job.type} (${job._id.toHexString()})`, error);
      const err = error instanceof Error ? error : new Error(String(error));
      await failJob(db, job, err);
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __jobWorkerStarted: boolean | undefined;
}

/** Inicia o loop de processamento de jobs uma unica vez por processo (chamado em `instrumentation.ts`). */
export function startJobWorker() {
  if (global.__jobWorkerStarted) return;
  global.__jobWorkerStarted = true;

  setInterval(() => {
    processOnce().catch((error) => console.error("[jobs] erro no loop de processamento", error));
  }, POLL_INTERVAL_MS);

  console.log("[jobs] worker iniciado");
}
