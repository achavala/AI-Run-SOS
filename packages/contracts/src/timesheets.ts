import { z } from 'zod';

export const CreateTimesheetSchema = z.object({
  placementId: z.string(),
  weekEnding: z.string().datetime(),
  hoursRegular: z.number().min(0).max(80).default(0),
  hoursOvertime: z.number().min(0).max(40).default(0),
});
export type CreateTimesheetInput = z.infer<typeof CreateTimesheetSchema>;

export const ApproveTimesheetSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().optional(),
});
export type ApproveTimesheetInput = z.infer<typeof ApproveTimesheetSchema>;
