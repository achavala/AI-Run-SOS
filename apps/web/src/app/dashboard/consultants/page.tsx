'use client';

import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserPlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface Consultant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  skills: string[];
  readiness: string;
  desiredRate: number | null;
  availableFrom: string | null;
  verificationStatus: string;
  trustScore: number | null;
  activeSubmissions: number;
  createdAt: string;
  updatedAt: string;
}

interface ConsultantsResponse {
  data: Consultant[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const READINESS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'NEW', label: 'New' },
  { key: 'DOCS_PENDING', label: 'Docs Pending' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'SUBMISSION_READY', label: 'Submission Ready' },
  { key: 'ON_ASSIGNMENT', label: 'On Assignment' },
  { key: 'OFFBOARDED', label: 'Offboarded' },
] as const;

const READINESS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700',
  DOCS_PENDING: 'bg-amber-100 text-amber-800',
  VERIFIED: 'bg-blue-100 text-blue-800',
  SUBMISSION_READY: 'bg-emerald-100 text-emerald-800',
  ON_ASSIGNMENT: 'bg-violet-100 text-violet-800',
  OFFBOARDED: 'bg-red-100 text-red-700',
};

const PAGE_SIZE = 50;

function computeMatchScore(skills: string[], searchTerm: string): number | null {
  if (!searchTerm.trim()) return null;
  const terms = searchTerm.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (terms.length === 0) return null;

  const normalizedSkills = skills.map((s) => s.toLowerCase());
  let matchCount = 0;
  for (const term of terms) {
    if (normalizedSkills.some((s) => s.includes(term))) matchCount++;
  }
  return Math.round((matchCount / terms.length) * 100);
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export default function ConsultantsPage() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [readinessFilter, setReadinessFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchConsultants = useCallback(
    async (p: number, s: string, r: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('page', String(p));
        params.set('pageSize', String(PAGE_SIZE));
        if (s.trim()) params.set('search', s.trim());
        if (r !== 'ALL') params.set('readiness', r);

        const res = await api.get<ConsultantsResponse>(
          `/consultants?${params.toString()}`,
        );
        setConsultants(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load consultants');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchConsultants(page, search, readinessFilter);
  }, [page, readinessFilter, fetchConsultants]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setPage(1);
      fetchConsultants(1, value, readinessFilter);
    }, 350);
  };

  const handleReadinessChange = (r: string) => {
    setReadinessFilter(r);
    setPage(1);
  };

  const startIdx = (page - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <PageHeader
        title="Consultants"
        description={`${formatNumber(total)} consultant${total !== 1 ? 's' : ''} in database`}
        actions={
          <button className="btn-primary">
            <UserPlusIcon className="h-4 w-4" />
            Add Consultant
          </button>
        }
      />

      {/* Search + Readiness Tabs */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or skill..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="input pl-9"
            />
          </div>
          <button
            onClick={() => fetchConsultants(page, search, readinessFilter)}
            className="rounded-lg border border-gray-300 bg-white p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            title="Refresh"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {READINESS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleReadinessChange(tab.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                readinessFilter === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading && consultants.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-24">
          <div className="flex flex-col items-center gap-3">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm text-gray-500">Loading consultants...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            onClick={() => fetchConsultants(page, search, readinessFilter)}
            className="mt-3 text-sm font-medium text-red-600 underline hover:text-red-800"
          >
            Try again
          </button>
        </div>
      ) : consultants.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No consultants match your filters.</p>
        </div>
      ) : (
        <>
          {/* Results info */}
          <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing {formatNumber(startIdx)}–{formatNumber(endIdx)} of{' '}
              {formatNumber(total)}
            </span>
            {loading && (
              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin text-indigo-500" />
            )}
          </div>

          {/* Consultant Cards */}
          <div className="grid gap-3">
            {consultants.map((c) => {
              const matchScore = computeMatchScore(c.skills, search);
              return (
                <div
                  key={c.id}
                  className="group rounded-xl border border-gray-200 bg-white px-5 py-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <h3 className="truncate text-sm font-semibold text-gray-900">
                          {c.firstName} {c.lastName}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            READINESS_COLORS[c.readiness] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {c.readiness.replace(/_/g, ' ')}
                        </span>
                        {matchScore !== null && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              matchScore >= 75
                                ? 'bg-emerald-100 text-emerald-800'
                                : matchScore >= 40
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            <SparklesIcon className="h-3 w-3" />
                            {matchScore}% match
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{c.email}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3 text-right">
                      {c.desiredRate != null && (
                        <span className="text-sm font-semibold text-gray-900">
                          ${c.desiredRate}
                          <span className="text-xs font-normal text-gray-400">/hr</span>
                        </span>
                      )}
                      {c.activeSubmissions > 0 && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                          {c.activeSubmissions} submission{c.activeSubmissions !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Skills */}
                  {c.skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.skills.slice(0, 6).map((skill) => (
                        <span
                          key={skill}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            search.trim() &&
                            skill.toLowerCase().includes(search.toLowerCase().trim())
                              ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {skill}
                        </span>
                      ))}
                      {c.skills.length > 6 && (
                        <span className="px-1 text-[10px] text-gray-400">
                          +{c.skills.length - 6} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="mt-2 flex items-center gap-4 text-[11px] text-gray-400">
                    {c.phone && <span>{c.phone}</span>}
                    {c.trustScore != null && (
                      <span>Trust: {c.trustScore.toFixed(0)}%</span>
                    )}
                    <span>Added {new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Page {page} of {formatNumber(totalPages)}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                {generatePageNumbers(page, totalPages).map((n, i) =>
                  n === -1 ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-400">
                      ...
                    </span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`min-w-[32px] rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                        page === n
                          ? 'bg-indigo-600 text-white'
                          : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {n}
                    </button>
                  ),
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function generatePageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: number[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push(-1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push(-1);
  pages.push(total);

  return pages;
}
