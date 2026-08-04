import { z } from "zod";

export const createCaseSchema = z.object({
  name: z.string().min(1).max(160),
  patientRef: z.string().max(160).optional(),
});
export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const updateCaseSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  patientRef: z.string().max(160).nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
