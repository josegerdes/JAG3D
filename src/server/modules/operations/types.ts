import { z } from "zod";

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const quat = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const transformDeltaSchema = z.object({
  deltaPosition: vec3,
  deltaQuaternion: quat,
  deltaScale: vec3,
});

/** Geometria nova (resultado de um corte booleano ou alivio, computado client-side) que substitui
 *  os bytes armazenados de uma malha — o cliente ja fez upload do arquivo resultante antes de
 *  chamar commitOperation (mesmo endpoint de upload usado pra malha nova), so referencia aqui. */
export const geometryReplacementSchema = z.object({
  storageKey: z.string().min(1),
  checksumSha256: z.string().length(64),
  sizeBytes: z.number().int().nonnegative(),
  triangleCount: z.number().int().nonnegative(),
});

export const commitOperationSchema = z.object({
  caseId: z.string(),
  type: z.enum(["transform", "booleanCut", "relief", "duplicate", "delete"]),
  targets: z
    .array(
      z.object({
        assetId: z.string(),
        expectedSyncVersion: z.number().int().nonnegative(),
        transformDelta: transformDeltaSchema.optional(),
        geometryReplacement: geometryReplacementSchema.optional(),
      })
    )
    .min(1)
    .max(64),
});
export type CommitOperationInput = z.infer<typeof commitOperationSchema>;

export const integrityCheckSchema = z.object({
  syncVersions: z.record(z.string(), z.number().int().nonnegative()),
});
export type IntegrityCheckInput = z.infer<typeof integrityCheckSchema>;
