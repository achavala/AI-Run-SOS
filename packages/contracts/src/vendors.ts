import { z } from 'zod';

export const CreateVendorSchema = z.object({
  companyName: z.string().min(1).max(200),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  paymentTermsDays: z.number().int().min(0).max(180).default(30),
});
export type CreateVendorInput = z.infer<typeof CreateVendorSchema>;

export const UpdateVendorSchema = CreateVendorSchema.partial();
export type UpdateVendorInput = z.infer<typeof UpdateVendorSchema>;

export interface VendorListItem {
  id: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  paymentTermsDays: number;
  msaStatus: string;
  trustScore: number | null;
  paySpeedDays: number | null;
  ghostRate: number | null;
  jobCount: number;
}
