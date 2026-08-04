import { z } from "zod";

export const rigidTransformSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  quaternion: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  scale: z.tuple([z.number(), z.number(), z.number()]),
});

export const updateMeshAssetSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  groupId: z.string().nullable().optional(),
  linkedGroupId: z.string().nullable().optional(),
});
export type UpdateMeshAssetInput = z.infer<typeof updateMeshAssetSchema>;

/** Limite de upload — arquivos de scan dental reais raramente passam de ~300MB mesmo em alta
 *  resolucao; cap generoso o suficiente pra nao atrapalhar caso legitimo, apertado o bastante pra
 *  nao virar vetor de esgotamento de disco num endpoint autenticado. */
export const MAX_MESH_UPLOAD_BYTES = 300 * 1024 * 1024;
