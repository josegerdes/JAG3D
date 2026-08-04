import { Db, ObjectId } from "mongodb";

import { collections } from "@/server/db/collections";
import { JobDoc } from "@/server/db/schema";

const DEFAULT_MAX_ATTEMPTS = 5;

export interface EnqueueOptions {
  runAt?: Date;
  maxAttempts?: number;
}

/** Fila de jobs baseada no Mongo — sem SaaS externo, pra manter o deploy em poucos containers. */
export async function enqueueJob(
  db: Db,
  type: string,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {}
) {
  const now = new Date();
  const job: JobDoc = {
    _id: new ObjectId(),
    type,
    payload,
    status: "pending",
    attempts: 0,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    runAt: options.runAt ?? now,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  await collections.jobs(db).insertOne(job);
  return job;
}

/** Reivindica atomicamente o proximo job pendente pronto pra rodar. */
export async function claimNextJob(db: Db): Promise<JobDoc | null> {
  return collections.jobs(db).findOneAndUpdate(
    { status: "pending", runAt: { $lte: new Date() } },
    { $set: { status: "processing", updatedAt: new Date() } },
    { sort: { runAt: 1 }, returnDocument: "after" }
  );
}

export async function completeJob(db: Db, jobId: ObjectId) {
  await collections
    .jobs(db)
    .updateOne({ _id: jobId }, { $set: { status: "done", error: null, updatedAt: new Date() } });
}

/** Backoff exponencial: 30s, 60s, 120s... ate `maxAttempts`, depois marca "failed" definitivamente. */
export async function failJob(db: Db, job: JobDoc, error: Error): Promise<boolean> {
  const attempts = job.attempts + 1;
  const exhausted = attempts >= job.maxAttempts;
  const backoffMs = Math.min(30_000 * 2 ** (attempts - 1), 30 * 60_000);

  await collections.jobs(db).updateOne(
    { _id: job._id },
    {
      $set: {
        status: exhausted ? "failed" : "pending",
        attempts,
        error: error.message,
        runAt: new Date(Date.now() + backoffMs),
        updatedAt: new Date(),
      },
    }
  );

  return exhausted;
}
