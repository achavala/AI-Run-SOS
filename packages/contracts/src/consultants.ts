import { z } from 'zod';

export const CreateConsultantSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  skills: z.array(z.string()).default([]),
  visaStatus: z.string().optional(),
  workAuthExpiry: z.string().datetime().optional(),
  availableFrom: z.string().datetime().optional(),
  desiredRate: z.number().positive().optional(),
});
export type CreateConsultantInput = z.infer<typeof CreateConsultantSchema>;

export const UpdateConsultantSchema = CreateConsultantSchema.partial();
export type UpdateConsultantInput = z.infer<typeof UpdateConsultantSchema>;

export const UpdateConsentPolicySchema = z.object({
  autoApproveVendors: z.array(z.string()).default([]),
  autoApproveAboveRate: z.number().positive().optional(),
  blockVendors: z.array(z.string()).default([]),
  requireExplicitConsent: z.boolean().default(true),
});
export type UpdateConsentPolicyInput = z.infer<typeof UpdateConsentPolicySchema>;

export interface ConsultantListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  skills: string[];
  visaStatus: string | null;
  availableFrom: string | null;
  verificationStatus: string;
  trustScore: number | null;
  activeSubmissions: number;
}
