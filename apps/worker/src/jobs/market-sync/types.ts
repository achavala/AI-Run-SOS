export interface RawMarketJob {
  externalId: string;
  source: string;
  title: string;
  company: string;
  description: string;
  location?: string;
  locationType?: 'REMOTE' | 'HYBRID' | 'ONSITE';
  applyUrl?: string;
  sourceUrl?: string;
  postedAt?: Date;
  sourcePostedAt?: Date;
  expiresAt?: Date;
  salaryMin?: number;
  salaryMax?: number;
  rateType?: 'HOURLY' | 'ANNUAL';
  recruiterName?: string;
  recruiterEmail?: string;
  recruiterPhone?: string;
  rawPayload?: Record<string, unknown>;
}

export interface JobProvider {
  name: string;
  source: string;
  isConfigured(): boolean;
  fetchJobs(queries: string[]): Promise<RawMarketJob[]>;
}
