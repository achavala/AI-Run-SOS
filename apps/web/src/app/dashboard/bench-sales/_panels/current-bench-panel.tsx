'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  UserIcon,
  EnvelopeIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import AddConsultantModal from '../_components/add-consultant-modal';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AiRunInfo {
  id: string;
  status: string;
  currentStep: string | null;
  stepsCompleted: number;
  totalSteps: number;
  readinessScore: number | null;
}

interface BenchConsultant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  skills: string[];
  desiredRate: number | null;
  availableFrom: string | null;
  benchStatus: string;
  readinessScore: number | null;
  visaType: string | null;
  latestAiRun: AiRunInfo | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BENCH_STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700',
  IN_PREPARATION: 'bg-amber-100 text-amber-800',
  READY_TO_MARKET: 'bg-emerald-100 text-emerald-800',
  NEEDS_INFO: 'bg-red-100 text-red-700',
  MARKETED: 'bg-blue-100 text-blue-800',
};

const BENCH_STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  IN_PREPARATION: 'In Preparation',
  READY_TO_MARKET: 'Ready to Market',
  NEEDS_INFO: 'Needs Info',
  MARKETED: 'Marketed',
};

const AI_STATUS_COLORS: Record<string, string> = {
  QUEUED: 'text-gray-500',
  PROCESSING: 'text-amber-600',
  COMPLETED: 'text-emerald-600',
  FAILED: 'text-red-600',
  NEEDS_REVIEW: 'text-orange-600',
};

const AI_STEP_LABELS: Record<string, string> = {
  RESUME_PARSING: 'Resume Parsing',
  RESUME_PREP: 'Resume Prep',
  TECH_PREP: 'Tech Prep',
  COACHING: 'Coaching',
  LINKEDIN_PREP: 'LinkedIn Prep',
  SALES_STRATEGY: 'Sales Strategy',
  JOB_SEARCH: 'Job Search',
  GM_STRATEGIST: 'GM Strategist',
};

const VISA_COLORS: Record<string, string> = {
  USC: 'bg-emerald-100 text-emerald-800',
  GC: 'bg-green-100 text-green-800',
  H1B: 'bg-blue-100 text-blue-800',
  OPT: 'bg-amber-100 text-amber-800',
  EAD: 'bg-violet-100 text-violet-800',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function scoreColor(score: number | null): string {
  if (score === null) return 'bg-gray-200';
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function scoreTextColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
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

/* ------------------------------------------------------------------ */
/*  Panel                                                              */
/* ------------------------------------------------------------------ */

export default function CurrentBenchPanel() {
  const router = useRouter();
  const [consultants, setConsultants] = useState<BenchConsultant[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchConsultants = useCallback(
    async (page = 1) => {
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: '25' });
        if (search) params.set('search', search);
        if (status !== 'ALL') params.set('status', status);
        if (sort) params.set('sort', sort);

        const result = await api.get<{
          items: Array<{
            id: string;
            firstName: string;
            lastName: string;
            email: string;
            phone: string | null;
            skills: string[];
            desiredRate: number | null;
            availableFrom: string | null;
            benchStatus: string;
            readinessScore: number | null;
            visa: string | null;
            aiRun: AiRunInfo | null;
            createdAt: string;
          }>;
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
        }>(`/bench-intake/current-bench?${params.toString()}`);

        setConsultants(
          result.items.map((c) => ({
            ...c,
            visaType: c.visa,
            latestAiRun: c.aiRun,
          })),
        );
        setPagination({
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        });
      } catch {
        /* handled */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, status, sort],
  );

  useEffect(() => {
    setLoading(true);
    fetchConsultants(1);
  }, [fetchConsultants]);

  // Auto-refresh every 10s when there are processing AI runs
  useEffect(() => {
    const hasProcessing = consultants.some(
      (c) => c.latestAiRun?.status === 'PROCESSING' || c.latestAiRun?.status === 'QUEUED',
    );
    if (!hasProcessing) return;
    const timer = setInterval(() => fetchConsultants(pagination.page), 10000);
    return () => clearInterval(timer);
  }, [consultants, pagination.page, fetchConsultants]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConsultants(pagination.page);
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    setRefreshing(true);
    fetchConsultants(1);
  };

  if (loading && consultants.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {/* Action Bar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Add Consultant
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter Row */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
            placeholder="Search name, email, skills..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ALL', label: 'All Status' },
            { value: 'NEW', label: 'New' },
            { value: 'IN_PREPARATION', label: 'In Preparation' },
            { value: 'READY_TO_MARKET', label: 'Ready to Market' },
            { value: 'NEEDS_INFO', label: 'Needs Info' },
            { value: 'MARKETED', label: 'Marketed' },
          ]}
        />
        <FilterSelect
          value={sort}
          onChange={setSort}
          options={[
            { value: 'newest', label: 'Newest First' },
            { value: 'readiness-desc', label: 'Highest Readiness' },
            { value: 'name-asc', label: 'Name A-Z' },
          ]}
        />
      </div>

      {/* Consultant List */}
      {consultants.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <UserIcon className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-600">No bench consultants yet</p>
          <p className="mt-1 text-xs text-gray-400">Click "Add Consultant" to onboard your first bench consultant</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            <PlusIcon className="h-4 w-4" />
            Add Consultant
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {consultants.map((c) => (
            <div
              key={c.id}
              onClick={() => router.push(`/dashboard/bench-sales/bench/${c.id}`)}
              className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-indigo-200"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: consultant info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {c.firstName} {c.lastName}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        BENCH_STATUS_COLORS[c.benchStatus] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {BENCH_STATUS_LABELS[c.benchStatus] ?? c.benchStatus}
                    </span>
                    {c.visaType && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          VISA_COLORS[c.visaType] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.visaType}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <EnvelopeIcon className="h-3.5 w-3.5" />
                      {c.email}
                    </span>
                    {c.desiredRate != null && (
                      <span className="flex items-center gap-1">
                        <CurrencyDollarIcon className="h-3.5 w-3.5" />
                        ${c.desiredRate}/hr
                      </span>
                    )}
                    {c.availableFrom && (
                      <span className="flex items-center gap-1">
                        <CalendarDaysIcon className="h-3.5 w-3.5" />
                        {new Date(c.availableFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {/* Skills */}
                  {c.skills && c.skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.skills.slice(0, 6).map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                        >
                          {skill}
                        </span>
                      ))}
                      {c.skills.length > 6 && (
                        <span className="text-[10px] text-gray-400">+{c.skills.length - 6} more</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: AI status + readiness */}
                <div className="shrink-0 text-right space-y-2">
                  {/* Readiness score */}
                  <div>
                    <div className="flex items-center justify-end gap-1">
                      <TagIcon className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Readiness
                      </span>
                    </div>
                    <span className={`text-lg font-bold ${scoreTextColor(c.readinessScore)}`}>
                      {c.readinessScore != null ? Math.round(c.readinessScore) : '--'}
                    </span>
                    <span className="text-xs text-gray-400">/100</span>
                  </div>

                  {/* AI Pipeline status */}
                  {c.latestAiRun && (
                    <div className="space-y-1">
                      <div
                        className={`flex items-center justify-end gap-1 text-[10px] font-medium ${
                          AI_STATUS_COLORS[c.latestAiRun.status] ?? 'text-gray-500'
                        }`}
                      >
                        {c.latestAiRun.status === 'PROCESSING' && (
                          <ArrowPathIcon className="h-3 w-3 animate-spin" />
                        )}
                        {c.latestAiRun.status === 'COMPLETED' && (
                          <CheckCircleIcon className="h-3 w-3" />
                        )}
                        {c.latestAiRun.status === 'FAILED' && (
                          <ExclamationCircleIcon className="h-3 w-3" />
                        )}
                        {c.latestAiRun.status === 'QUEUED' && (
                          <ClockIcon className="h-3 w-3" />
                        )}
                        <span>
                          {c.latestAiRun.status === 'PROCESSING'
                            ? AI_STEP_LABELS[c.latestAiRun.currentStep ?? ''] ?? 'Processing...'
                            : c.latestAiRun.status}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 w-24 rounded-full bg-gray-100 overflow-hidden ml-auto">
                        <div
                          className={`h-full rounded-full transition-all ${
                            c.latestAiRun.status === 'COMPLETED'
                              ? 'bg-emerald-500'
                              : c.latestAiRun.status === 'FAILED'
                              ? 'bg-red-500'
                              : 'bg-indigo-500'
                          }`}
                          style={{
                            width: `${(c.latestAiRun.stepsCompleted / c.latestAiRun.totalSteps) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {c.latestAiRun.stepsCompleted}/{c.latestAiRun.totalSteps} steps
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <span className="text-xs text-gray-500">
            Showing {(pagination.page - 1) * pagination.pageSize + 1}&ndash;
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => fetchConsultants(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => fetchConsultants(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add Consultant Modal */}
      {showAddModal && (
        <AddConsultantModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
        />
      )}
    </>
  );
}
