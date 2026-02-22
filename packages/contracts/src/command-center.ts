import { z } from 'zod';

export const PodEnum = z.enum(['SWE', 'CLOUD_DEVOPS', 'DATA', 'CYBER']);
export type Pod = z.infer<typeof PodEnum>;

const ScoreboardTargetsSchema = z.object({
  qualifiedReqs: z.number().int(),
  submissions: z.number().int(),
  interviews: z.number().int(),
  activeOffers: z.number().int(),
  closures: z.number().int(),
});

const ConversionStageSchema = z.object({
  current: z.number().nullable(),
  previous: z.number().nullable(),
  trend: z.enum(['up', 'down', 'stable']),
});

const KpiCardSchema = z.object({
  value: z.number(),
  formattedValue: z.string(),
  change: z.string().nullable(),
  changeType: z.enum(['positive', 'negative', 'neutral']),
  subtitle: z.string(),
});

const PipelineStageSchema = z.object({
  stage: z.string(),
  status: z.string(),
  count: z.number().int(),
  estWeeklyRevenue: z.number(),
});

const RiskItemSchema = z.object({
  type: z.string(),
  description: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  metric: z.number().optional(),
  metricLabel: z.string().optional(),
});

const VendorTrustSchema = z.object({
  vendorId: z.string(),
  name: z.string(),
  score: z.number(),
  paySpeed: z.number(),
  jobs: z.number().int(),
  trend: z.enum(['up', 'down', 'stable']),
});

const ActivityItemSchema = z.object({
  action: z.string(),
  detail: z.string(),
  time: z.string(),
  channel: z.string(),
  direction: z.string(),
  isAgent: z.boolean(),
});

export const CommandCenterSchema = z.object({
  dailyScoreboard: z.object({
    date: z.string(),
    targets: ScoreboardTargetsSchema,
    actuals: ScoreboardTargetsSchema,
  }),
  podFocus: z.object({
    currentPod: PodEnum.nullable(),
    reason: z.string().nullable(),
    reqCount: z.number().int(),
    benchReady: z.number().int(),
    avgMargin: z.number(),
  }),
  conversionFunnel: z.object({
    subToInterview: ConversionStageSchema,
    interviewToOffer: ConversionStageSchema,
    offerToAccept: ConversionStageSchema,
  }),
  marginHealth: z.object({
    avgMarginHr: z.number().nullable(),
    marginSafePct: z.number().nullable(),
    overrideCount: z.number().int(),
    averageMarginPct: z.number(),
  }),
  kpiCards: z.object({
    revenuePipeline: KpiCardSchema,
    activePlacements: KpiCardSchema,
    marginHealth: KpiCardSchema,
    arAtRisk: KpiCardSchema,
  }),
  submissionPipeline: z.array(PipelineStageSchema),
  riskMonitor: z.array(RiskItemSchema),
  vendorTrustScores: z.array(VendorTrustSchema),
  recentActivity: z.array(ActivityItemSchema),
  snapshot: z.object({
    openJobs: z.number().int(),
    activePlacements: z.number().int(),
    submissionsLast30Days: z.number().int(),
    arTotal: z.number(),
    arOverdue: z.number(),
  }),
});

export type CommandCenterData = z.infer<typeof CommandCenterSchema>;
export type ScoreboardTargets = z.infer<typeof ScoreboardTargetsSchema>;
export type ConversionStage = z.infer<typeof ConversionStageSchema>;
export type KpiCardData = z.infer<typeof KpiCardSchema>;
export type PipelineStage = z.infer<typeof PipelineStageSchema>;
export type RiskItem = z.infer<typeof RiskItemSchema>;
export type VendorTrust = z.infer<typeof VendorTrustSchema>;
export type ActivityItem = z.infer<typeof ActivityItemSchema>;
