import { z } from 'zod';

export const CreateJobSchema = z.object({
  vendorId: z.string(),
  title: z.string().min(1).max(300),
  description: z.string().min(1),
  skills: z.array(z.string()).default([]),
  location: z.string().optional(),
  locationType: z.enum(['REMOTE', 'HYBRID', 'ONSITE']).default('REMOTE'),
  rateMin: z.number().positive().optional(),
  rateMax: z.number().positive().optional(),
  rateType: z.enum(['HOURLY', 'ANNUAL']).default('HOURLY'),
  startDate: z.string().datetime().optional(),
  durationMonths: z.number().int().positive().optional(),
});
export type CreateJobInput = z.infer<typeof CreateJobSchema>;

export const UpdateJobSchema = CreateJobSchema.partial().omit({ vendorId: true });
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;

export const JobIntakeRawSchema = z.object({
  rawText: z.string().min(10),
  vendorId: z.string(),
  sourceEmail: z.string().email().optional(),
});
export type JobIntakeRawInput = z.infer<typeof JobIntakeRawSchema>;

export interface JobListItem {
  id: string;
  title: string;
  vendorName: string;
  skills: string[];
  location: string | null;
  locationType: string;
  rateMin: number | null;
  rateMax: number | null;
  status: string;
  closureLikelihood: number | null;
  submissionCount: number;
  createdAt: string;
}
