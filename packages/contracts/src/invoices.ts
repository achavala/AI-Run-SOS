import { z } from 'zod';

export const CreateInvoiceSchema = z.object({
  vendorId: z.string(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totalAmount: z.number().positive(),
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

export const UpdateInvoiceStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'DISPUTED']),
  paidAmount: z.number().positive().optional(),
  paidAt: z.string().datetime().optional(),
});
export type UpdateInvoiceStatusInput = z.infer<typeof UpdateInvoiceStatusSchema>;
