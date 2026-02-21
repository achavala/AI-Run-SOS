import { z } from 'zod';

export const TrustEntityType = {
  VENDOR: 'VENDOR',
  CONSULTANT: 'CONSULTANT',
  RECRUITER: 'RECRUITER',
} as const;
export type TrustEntityType = (typeof TrustEntityType)[keyof typeof TrustEntityType];

export const RecordTrustEventSchema = z.object({
  entityType: z.enum(['VENDOR', 'CONSULTANT', 'RECRUITER']),
  entityId: z.string(),
  eventType: z.string(),
  delta: z.number(),
  reason: z.string(),
  metadata: z.record(z.unknown()).optional(),
});
export type RecordTrustEventInput = z.infer<typeof RecordTrustEventSchema>;

export interface TrustScoreSummary {
  entityType: string;
  entityId: string;
  currentScore: number;
  recentEvents: {
    eventType: string;
    delta: number;
    reason: string;
    createdAt: string;
  }[];
}

export interface VendorTrustProfile {
  vendorId: string;
  companyName: string;
  trustScore: number;
  paySpeedDays: number;
  ghostRate: number;
  disputeFrequency: number;
  feedbackLatencyHrs: number;
  trend: 'improving' | 'stable' | 'declining';
}
