import { z } from "zod";

export const createGroupSchema = z.object({
  caseId: z.string(),
  name: z.string().min(1).max(160),
  meshAssetIds: z.array(z.string()).min(1),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
});
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
