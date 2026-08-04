import { Db } from "mongodb";

export type JobHandler = (db: Db, payload: Record<string, unknown>) => Promise<void>;

/**
 * Registry de handlers de job por `type`. Cada modulo que precisa de um job
 * assincrono importa este arquivo e adiciona sua entrada aqui (ex: o modulo
 * `licenses` registra "license-expiry-sweep") — mantido num arquivo separado
 * de `worker.ts` pra evitar import ciclico entre modulos de dominio e o worker.
 */
export const HANDLERS: Record<string, JobHandler> = {};

export function registerJobHandler(type: string, handler: JobHandler): void {
  HANDLERS[type] = handler;
}
