import { z } from "zod";

import { rigidTransformSchema } from "@/server/modules/mesh-assets/types";

export const createComparisonSchema = z.object({
  caseId: z.string(),
  beforeAssetId: z.string(),
  afterAssetId: z.string(),
});
export type CreateComparisonInput = z.infer<typeof createComparisonSchema>;

export const setAlignmentSchema = z.object({
  alignmentTransform: rigidTransformSchema,
});
export type SetAlignmentInput = z.infer<typeof setAlignmentSchema>;
