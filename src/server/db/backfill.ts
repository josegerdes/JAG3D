import { Db } from "mongodb";

/**
 * Runner generico de backfill em boot. Existe porque um campo novo adicionado
 * a um schema Mongo NUNCA se aplica retroativamente a documentos ja
 * persistidos — bug recorrente ja visto em todo projeto irmao desta linhagem
 * (site-config fields, permissoes RBAC, defaults de curso...). Cada entrada
 * aqui e idempotente e roda toda vez que o processo sobe (via `instrumentation.ts`),
 * nao so uma vez no seed inicial.
 */
export interface Backfill {
  /** Identificador estavel — usado so em log, nao controla se roda ou nao (roda sempre, idempotente). */
  version: string;
  description: string;
  run(db: Db): Promise<void>;
}

const BACKFILLS: Backfill[] = [];

export function registerBackfill(backfill: Backfill): void {
  BACKFILLS.push(backfill);
}

export async function runBackfills(db: Db): Promise<void> {
  for (const backfill of BACKFILLS) {
    try {
      await backfill.run(db);
    } catch (error) {
      console.error(`[backfill] falha em "${backfill.version}" (${backfill.description}):`, error);
    }
  }
}
