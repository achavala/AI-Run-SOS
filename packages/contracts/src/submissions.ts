import { z } from 'zod';

export const CreateSubmissionSchema = z.object({
  jobId: z.string(),
  consultantId: z.string(),
  resumeVersion: z.string().optional(),
  rtrDocUrl: z.string().url().optional(),
  notes: z.string().optional(),
});
export type CreateSubmissionInput = z.infer<typeof CreateSubmissionSchema>;

export const UpdateSubmissionStatusSchema = z.object({
  status: z.enum([
    'DRAFT', 'PENDING_CONSENT', 'AWAITING_CONSENT',
    'SUBMITTED', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN',
  ]),
  vendorFeedback: z.string().optional(),
});
export type UpdateSubmissionStatusInput = z.infer<typeof UpdateSubmissionStatusSchema>;

export interface SubmissionListItem {
  id: string;
  jobTitle: string;
  vendorName: string;
  consultantName: string;
  status: string;
  submitterType: string;
  consentType: string | null;
  createdAt: string;
  feedbackReceivedAt: string | null;
}
