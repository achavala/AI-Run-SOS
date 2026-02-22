'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  FunnelIcon,
  ClockIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface MarketJob {
  id: string;
  externalId: string;
  source: string;
  title: string;
  company: string;
  description: string;
  location: string | null;
  locationType: string;
  employmentType: string;
  classificationConfidence: number;
  negativeSignals: string[];
  rateText: string | null;
  rateMin: number | null;
  rateMax: number | null;
  compPeriod: string;
  hourlyRateMin: number | null;
  hourlyRateMax: number | null;
  skills: string[];
  applyUrl: string | null;
  sourceUrl: string | null;
  recruiterName: string | null;
  recruiterEmail: string | null;
  recruiterPhone: string | null;
  recruiterLinkedIn: string | null;
  fingerprint: string | null;
  postedAt: string | null;
  sourcePostedAt: string | null;
  expiresAt: string | null;
  discoveredAt: string;
  lastSeenAt: string;
  status: string;
  urlStatus: string | null;
  urlVerifiedAt: string | null;
  realnessScore: number | null;
  realnessReasons: string[];
  actionabilityScore: number | null;
  actionabilityReasons: string[];
  matchedVendorId: string | null;
  companyDomain: string | null;
  convertedToJobId: string | null;
  convertedAt: string | null;
  canonical: { jobCount: number; firstSeenAt: string } | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface Stats {
  total: number;
  active: number;
  stale: number;
  converted: number;
  uniqueJobs: number;
  todayCount: number;
  fresh6h: number;
  fresh24h: number;
  urlAlive: number;
  urlDead: number;
  avgRealnessScore: number;
  lastSync: string | null;
  byEmploymentType: Record<string, number>;
  bySource: Record<string, number>;
  byLocationType: Record<string, number>;
}

const TYPE_COLORS: Record<string, string> = {
  C2C: 'bg-purple-100 text-purple-700 ring-purple-600/20',
  W2: 'bg-blue-100 text-blue-700 ring-blue-600/20',
  W2_1099: 'bg-teal-100 text-teal-700 ring-teal-600/20',
  CONTRACT: 'bg-amber-100 text-amber-700 ring-amber-600/20',
  FULLTIME: 'bg-green-100 text-green-700 ring-green-600/20',
  PARTTIME: 'bg-gray-100 text-gray-700 ring-gray-600/20',
  UNKNOWN: 'bg-gray-50 text-gray-500 ring-gray-400/20',
};

const TYPE_LABELS: Record<string, string> = {
  C2C: 'C2C',
  W2: 'W2',
  W2_1099: 'W2/1099',
  CONTRACT: 'Contract',
  FULLTIME: 'Full-time',
  PARTTIME: 'Part-time',
  UNKNOWN: 'Unknown',
};

const SOURCE_LABELS: Record<string, string> = {
  JSEARCH: 'Google Jobs',
  JOOBLE: 'Jooble',
  ADZUNA: 'Adzuna',
  ARBEITNOW: 'Arbeitnow',
  CAREERJET: 'Careerjet',
  DICE: 'Dice',
  LINKEDIN: 'LinkedIn',
  INDEED: 'Indeed',
  ZIPRECRUITER: 'ZipRecruiter',
  OTHER: 'Other',
};

const LOCATION_ICONS: Record<string, string> = {
  REMOTE: 'bg-emerald-50 text-emerald-700',
  HYBRID: 'bg-blue-50 text-blue-700',
  ONSITE: 'bg-amber-50 text-amber-700',
};

function formatRate(min: number | null, max: number | null, rateText: string | null): string {
  if (rateText) return rateText;
  if (!min && !max) return '—';
  if (min && max && min !== max) return `$${Math.round(min)}-$${Math.round(max)}/hr`;
  return `$${Math.round(min ?? max!)}/hr`;
}

function formatHourlyRate(min: number | null, max: number | null): string {
  if (!min && !max) return '—';
  if (min && max && min !== max) return `$${Math.round(min)}-$${Math.round(max)}/hr`;
  return `$${Math.round(min ?? max!)}/hr`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function realnessColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 70) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-500';
}

function realnessLabel(score: number | null): string {
  if (score === null) return '—';
  if (score >= 70) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

function urlStatusBadge(status: string | null) {
  if (!status || status === 'UNKNOWN') return null;
  if (status === 'ALIVE')
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
        <CheckBadgeIcon className="h-3 w-3" /> Live
      </span>
    );
  if (status === 'DEAD')
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
        <XCircleIcon className="h-3 w-3" /> Dead
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
      <ExclamationTriangleIcon className="h-3 w-3" /> Redirect
    </span>
  );
}

export default function MarketJobsPage() {
  const [jobs, setJobs] = useState<MarketJob[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<MarketJob | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [employmentType, setEmploymentType] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [locationType, setLocationType] = useState('ALL');
  const [freshness, setFreshness] = useState('24h');
  const [sortBy, setSortBy] = useState('realnessScore');

  const fetchJobs = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search) params.set('search', search);
      if (employmentType !== 'ALL') params.set('employmentType', employmentType);
      if (source !== 'ALL') params.set('source', source);
      if (locationType !== 'ALL') params.set('locationType', locationType);
      if (freshness !== 'ALL') params.set('freshness', freshness);
      if (sortBy) params.set('sortBy', sortBy);

      const result = await api.get<{ jobs: MarketJob[]; pagination: Pagination }>(
        `/market-jobs?${params.toString()}`,
      );
      setJobs(result.jobs);
      setPagination(result.pagination);
    } catch {
      /* handled by error boundary */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, employmentType, source, locationType, freshness, sortBy]);

  const fetchStats = useCallback(async () => {
    try {
      const result = await api.get<Stats>('/market-jobs/stats');
      setStats(result);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchJobs(1);
    fetchStats();
  }, [fetchJobs, fetchStats]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchJobs(pagination.page);
    fetchStats();
  };

  if (loading && jobs.length === 0) {
    return (
      <>
        <PageHeader title="Market Jobs" description="C2C & W2 openings aggregated hourly from job APIs" />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Market Jobs"
        description="Tier B — C2C & W2 openings aggregated hourly — freshness-verified"
        actions={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Stats Bar */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-10">
          <StatCard label="Active" value={String(stats.active)} />
          <StatCard label="Fresh 6h" value={String(stats.fresh6h)} accent />
          <StatCard label="Fresh 24h" value={String(stats.fresh24h)} accent />
          <StatCard label="Unique" value={String(stats.uniqueJobs)} />
          <StatCard label="C2C" value={String(stats.byEmploymentType?.C2C ?? 0)} />
          <StatCard label="W2" value={String(stats.byEmploymentType?.W2 ?? 0)} />
          <StatCard label="URL Live" value={String(stats.urlAlive)} />
          <StatCard label="Avg Score" value={String(stats.avgRealnessScore)} />
          <StatCard label="Converted" value={String(stats.converted)} />
          <StatCard
            label="Last Sync"
            value={stats.lastSync ? timeAgo(stats.lastSync) : 'Never'}
          />
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
            placeholder="Search jobs, companies, skills..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FunnelIcon className="h-4 w-4 text-gray-400" />
          <FilterSelect
            value={freshness}
            onChange={setFreshness}
            options={[
              { value: '6h', label: 'Last 6h' },
              { value: '24h', label: 'Last 24h' },
              { value: '3d', label: 'Last 3 days' },
              { value: '7d', label: 'This week' },
              { value: 'ALL', label: 'All time' },
            ]}
          />
          <FilterSelect
            value={employmentType}
            onChange={setEmploymentType}
            options={[
              { value: 'ALL', label: 'All Types' },
              { value: 'C2C', label: 'C2C' },
              { value: 'W2', label: 'W2' },
              { value: 'W2_1099', label: 'W2/1099' },
              { value: 'CONTRACT', label: 'Contract' },
              { value: 'FULLTIME', label: 'Full-time' },
            ]}
          />
          <FilterSelect
            value={source}
            onChange={setSource}
            options={[
              { value: 'ALL', label: 'All Sources' },
              { value: 'JSEARCH', label: 'Google Jobs' },
              { value: 'JOOBLE', label: 'Jooble' },
              { value: 'ADZUNA', label: 'Adzuna' },
              { value: 'ARBEITNOW', label: 'Arbeitnow' },
              { value: 'CAREERJET', label: 'Careerjet' },
            ]}
          />
          <FilterSelect
            value={locationType}
            onChange={setLocationType}
            options={[
              { value: 'ALL', label: 'All Locations' },
              { value: 'REMOTE', label: 'Remote' },
              { value: 'HYBRID', label: 'Hybrid' },
              { value: 'ONSITE', label: 'On-site' },
            ]}
          />
          <FilterSelect
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'realnessScore', label: 'Best Match' },
              { value: 'actionabilityScore', label: 'Most Actionable' },
              { value: 'sourcePostedAt', label: 'Newest First' },
              { value: 'hourlyRateMax', label: 'Highest Rate' },
            ]}
          />
        </div>
      </div>

      {/* Job Grid + Detail Panel */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Job List */}
        <div className="xl:col-span-2 space-y-3">
          {jobs.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">
                {stats?.active === 0
                  ? 'No market jobs synced yet. Configure API keys and run the sync.'
                  : 'No jobs match your filters. Try expanding the freshness window.'}
              </p>
            </div>
          ) : (
            jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={`w-full text-left rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                  selectedJob?.id === job.id
                    ? 'border-indigo-400 ring-2 ring-indigo-100'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {job.title}
                      </h3>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                          TYPE_COLORS[job.employmentType] ?? TYPE_COLORS.UNKNOWN
                        }`}
                      >
                        {TYPE_LABELS[job.employmentType] ?? job.employmentType}
                      </span>
                      {urlStatusBadge(job.urlStatus)}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-600">{job.company}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="h-3.5 w-3.5" />
                          {job.location}
                          <span
                            className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              LOCATION_ICONS[job.locationType] ?? ''
                            }`}
                          >
                            {job.locationType}
                          </span>
                        </span>
                      )}
                      {(job.hourlyRateMin || job.hourlyRateMax || job.rateText) && (
                        <span className="flex items-center gap-1">
                          <CurrencyDollarIcon className="h-3.5 w-3.5" />
                          {formatRate(job.hourlyRateMin, job.hourlyRateMax, job.rateText)}
                        </span>
                      )}
                      {(job.sourcePostedAt || job.postedAt) && (
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-3.5 w-3.5" />
                          {timeAgo(job.sourcePostedAt ?? job.postedAt!)}
                        </span>
                      )}
                    </div>
                    {job.skills && (job.skills as string[]).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(job.skills as string[]).slice(0, 6).map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                          >
                            {skill}
                          </span>
                        ))}
                        {(job.skills as string[]).length > 6 && (
                          <span className="text-[10px] text-gray-400">
                            +{(job.skills as string[]).length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <span className="text-[10px] font-medium text-gray-400">
                      {SOURCE_LABELS[job.source] ?? job.source}
                    </span>
                    {/* Realness + Actionability score badges */}
                    <div className="flex items-center gap-2">
                      {job.realnessScore !== null && (
                        <div className={`flex items-center gap-0.5 text-[10px] font-bold ${realnessColor(job.realnessScore)}`} title="Realness">
                          <ShieldCheckIcon className="h-3.5 w-3.5" />
                          {job.realnessScore}
                        </div>
                      )}
                      {job.actionabilityScore !== null && job.actionabilityScore !== undefined && (
                        <div className={`flex items-center gap-0.5 text-[10px] font-bold ${
                          job.actionabilityScore >= 70 ? 'text-blue-600'
                          : job.actionabilityScore >= 50 ? 'text-amber-600'
                          : 'text-gray-400'
                        }`} title="Actionability">
                          <CheckBadgeIcon className="h-3.5 w-3.5" />
                          {job.actionabilityScore}
                        </div>
                      )}
                    </div>
                    {job.status === 'CONVERTED' && (
                      <span className="block text-[10px] font-semibold text-green-600">Converted</span>
                    )}
                    {job.status === 'STALE' && (
                      <span className="block text-[10px] font-semibold text-amber-500">Stale</span>
                    )}
                    {job.negativeSignals && (job.negativeSignals as string[]).length > 0 && (
                      <span className="block text-[10px] font-semibold text-red-500">
                        {(job.negativeSignals as string[])[0]}
                      </span>
                    )}
                    {job.canonical && job.canonical.jobCount > 1 && (
                      <span className="block text-[10px] text-gray-400">
                        {job.canonical.jobCount} sources
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="text-xs text-gray-500">
                Showing {(pagination.page - 1) * pagination.pageSize + 1}–
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => fetchJobs(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => fetchJobs(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="xl:col-span-1">
          {selectedJob ? (
            <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{selectedJob.title}</h3>
                  <p className="text-sm text-gray-600">{selectedJob.company}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                    TYPE_COLORS[selectedJob.employmentType] ?? TYPE_COLORS.UNKNOWN
                  }`}
                >
                  {TYPE_LABELS[selectedJob.employmentType] ?? selectedJob.employmentType}
                </span>
              </div>

              {/* Realness Score Bar */}
              {selectedJob.realnessScore !== null && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                      <ShieldCheckIcon className="h-4 w-4" />
                      Realness Score
                    </span>
                    <span className={`text-sm font-bold ${realnessColor(selectedJob.realnessScore)}`}>
                      {selectedJob.realnessScore}/100 · {realnessLabel(selectedJob.realnessScore)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        selectedJob.realnessScore >= 70
                          ? 'bg-emerald-500'
                          : selectedJob.realnessScore >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${selectedJob.realnessScore}%` }}
                    />
                  </div>
                  {selectedJob.realnessReasons && (selectedJob.realnessReasons as string[]).length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[10px] text-gray-500 hover:text-gray-700">
                        Score breakdown
                      </summary>
                      <ul className="mt-1 space-y-0.5 text-[10px] text-gray-500">
                        {(selectedJob.realnessReasons as string[]).map((r, i) => (
                          <li key={i} className={r.startsWith('-') ? 'text-red-500' : 'text-emerald-600'}>{r}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              {/* Actionability Score Bar */}
              {selectedJob.actionabilityScore !== null && selectedJob.actionabilityScore !== undefined && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                      <CheckBadgeIcon className="h-4 w-4" />
                      Actionability Score
                    </span>
                    <span className={`text-sm font-bold ${
                      selectedJob.actionabilityScore >= 70 ? 'text-emerald-600'
                      : selectedJob.actionabilityScore >= 50 ? 'text-amber-600'
                      : 'text-red-600'
                    }`}>
                      {selectedJob.actionabilityScore}/100 · {
                        selectedJob.actionabilityScore >= 70 ? 'High' :
                        selectedJob.actionabilityScore >= 50 ? 'Medium' : 'Low'
                      }
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        selectedJob.actionabilityScore >= 70
                          ? 'bg-blue-500'
                          : selectedJob.actionabilityScore >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${selectedJob.actionabilityScore}%` }}
                    />
                  </div>
                  {selectedJob.matchedVendorId && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                      <CheckBadgeIcon className="h-3 w-3" /> Matched to known vendor
                    </div>
                  )}
                  {selectedJob.actionabilityReasons && (selectedJob.actionabilityReasons as string[]).length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[10px] text-gray-500 hover:text-gray-700">
                        Actionability breakdown
                      </summary>
                      <ul className="mt-1 space-y-0.5 text-[10px] text-gray-500">
                        {(selectedJob.actionabilityReasons as string[]).map((r, i) => (
                          <li key={i} className={r.startsWith('-') ? 'text-red-500' : 'text-blue-600'}>{r}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              {/* Negative Signals Warning */}
              {selectedJob.negativeSignals && (selectedJob.negativeSignals as string[]).length > 0 && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5">
                  <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">Restrictions</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(selectedJob.negativeSignals as string[]).map((sig) => (
                      <span key={sig} className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                        {sig}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Info */}
              <div className="mt-4 space-y-2">
                {selectedJob.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPinIcon className="h-4 w-4 text-gray-400" />
                    {selectedJob.location}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        LOCATION_ICONS[selectedJob.locationType] ?? ''
                      }`}
                    >
                      {selectedJob.locationType}
                    </span>
                  </div>
                )}
                {(selectedJob.hourlyRateMin || selectedJob.hourlyRateMax || selectedJob.rateText) && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                    <span>{formatRate(selectedJob.hourlyRateMin, selectedJob.hourlyRateMax, selectedJob.rateText)}</span>
                    {selectedJob.hourlyRateMin && (
                      <span className="text-[10px] text-gray-400">
                        ({formatHourlyRate(selectedJob.hourlyRateMin, selectedJob.hourlyRateMax)} normalized)
                      </span>
                    )}
                  </div>
                )}
                {(selectedJob.sourcePostedAt || selectedJob.postedAt) && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ClockIcon className="h-4 w-4 text-gray-400" />
                    Posted {timeAgo(selectedJob.sourcePostedAt ?? selectedJob.postedAt!)}
                    {selectedJob.sourcePostedAt && selectedJob.sourcePostedAt !== selectedJob.postedAt && (
                      <span className="text-[10px] text-gray-400">(source time)</span>
                    )}
                  </div>
                )}
                {/* URL Status */}
                {selectedJob.urlStatus && selectedJob.urlStatus !== 'UNKNOWN' && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {urlStatusBadge(selectedJob.urlStatus)}
                    {selectedJob.urlVerifiedAt && (
                      <span className="text-[10px] text-gray-400">
                        Checked {timeAgo(selectedJob.urlVerifiedAt)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Recruiter Contact */}
              {(selectedJob.recruiterName || selectedJob.recruiterEmail || selectedJob.recruiterPhone) && (
                <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Recruiter Contact</p>
                  <div className="mt-2 space-y-1.5">
                    {selectedJob.recruiterName && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <UserIcon className="h-3.5 w-3.5 text-indigo-500" />
                        {selectedJob.recruiterName}
                      </div>
                    )}
                    {selectedJob.recruiterEmail && (
                      <a
                        href={`mailto:${selectedJob.recruiterEmail}`}
                        className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                      >
                        <EnvelopeIcon className="h-3.5 w-3.5" />
                        {selectedJob.recruiterEmail}
                      </a>
                    )}
                    {selectedJob.recruiterPhone && (
                      <a
                        href={`tel:${selectedJob.recruiterPhone}`}
                        className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                      >
                        <PhoneIcon className="h-3.5 w-3.5" />
                        {selectedJob.recruiterPhone}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Skills */}
              {selectedJob.skills && (selectedJob.skills as string[]).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedJob.skills as string[]).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-1.5">Description</p>
                <div className="max-h-60 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 leading-relaxed">
                  {selectedJob.description.length > 2000
                    ? selectedJob.description.slice(0, 2000) + '...'
                    : selectedJob.description}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 space-y-2">
                <div className="flex gap-2">
                  {selectedJob.applyUrl && (
                    <a
                      href={selectedJob.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      Apply / Submit
                    </a>
                  )}
                  {selectedJob.sourceUrl && selectedJob.sourceUrl !== selectedJob.applyUrl && (
                    <a
                      href={selectedJob.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                    >
                      View Source
                    </a>
                  )}
                </div>

                {selectedJob.status !== 'CONVERTED' ? (
                  <ConvertToReqButton
                    marketJobId={selectedJob.id}
                    onConverted={(jobId) => {
                      setSelectedJob({ ...selectedJob, status: 'CONVERTED', convertedToJobId: jobId, convertedAt: new Date().toISOString() });
                      fetchJobs(pagination.page);
                      fetchStats();
                    }}
                  />
                ) : (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-2.5 text-center">
                    <p className="text-xs font-semibold text-green-700">Converted to internal req</p>
                    {selectedJob.convertedAt && (
                      <p className="text-[10px] text-green-600">{timeAgo(selectedJob.convertedAt)}</p>
                    )}
                  </div>
                )}
              </div>

              <p className="mt-3 text-center text-[10px] text-gray-400">
                Source: {SOURCE_LABELS[selectedJob.source] ?? selectedJob.source} · Discovered{' '}
                {timeAgo(selectedJob.discoveredAt)}
                {selectedJob.canonical && selectedJob.canonical.jobCount > 1 && (
                  <> · Found on {selectedJob.canonical.jobCount} boards</>
                )}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <p className="text-sm text-gray-400">Select a job to view details</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${accent ? 'text-indigo-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      className="rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function ConvertToReqButton({
  marketJobId,
  onConverted,
}: {
  marketJobId: string;
  onConverted: (jobId: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [pod, setPod] = useState('');
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<Array<{ id: string; companyName: string }>>([]);

  useEffect(() => {
    if (showForm && vendors.length === 0) {
      api.get<Array<{ id: string; companyName: string }>>('/vendors')
        .then(setVendors)
        .catch(() => {});
    }
  }, [showForm, vendors.length]);

  const handleConvert = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const result = await api.post<{ job: { id: string } }>(`/market-jobs/${marketJobId}/convert`, {
        vendorId,
        pod: pod || undefined,
      });
      onConverted(result.job.id);
      setShowForm(false);
    } catch (err) {
      console.error('Convert failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition"
      >
        Convert to Internal Req
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
      <p className="text-xs font-semibold text-emerald-700">Convert to Internal Req</p>
      <select
        value={vendorId}
        onChange={(e) => setVendorId((e.target as HTMLSelectElement).value)}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
      >
        <option value="">Select vendor...</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>{v.companyName}</option>
        ))}
      </select>
      <select
        value={pod}
        onChange={(e) => setPod((e.target as HTMLSelectElement).value)}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
      >
        <option value="">Select pod (optional)...</option>
        <option value="SWE">SWE</option>
        <option value="CLOUD_DEVOPS">Cloud/DevOps</option>
        <option value="DATA">Data</option>
        <option value="CYBER">Cyber</option>
      </select>
      <div className="flex gap-2">
        <button
          onClick={handleConvert}
          disabled={!vendorId || loading}
          className="flex-1 rounded bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? 'Converting...' : 'Create Req'}
        </button>
        <button
          onClick={() => setShowForm(false)}
          className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
