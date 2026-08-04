import { z } from "zod";

export const issueLicenseSchema = z.object({
  userId: z.string(),
  plan: z.string().min(1).max(60).default("standard"),
  expiresAt: z.coerce.date(),
});
export type IssueLicenseInput = z.infer<typeof issueLicenseSchema>;

export const extendLicenseSchema = z.object({
  expiresAt: z.coerce.date(),
});
export type ExtendLicenseInput = z.infer<typeof extendLicenseSchema>;

export const revokeLicenseSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type RevokeLicenseInput = z.infer<typeof revokeLicenseSchema>;
