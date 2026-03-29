'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  UserIcon,
  StarIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TechCategory {
  key: string;
  label: string;
  keywordCount: number;
  premiumFamilies: string[];
}

interface ConsultantTechCategory {
  key: string;
  label: string;
  matchCount: number;
}

interface Consultant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  skills: string[];
  desiredRate: number | null;
  readiness: string;
  qualityScore: number | null;
  placeabilityScore: number;
  availableFrom: string | null;
  visaBadge: string | null;
  visaType: string | null;
  techCategories: ConsultantTechCategory[];
  currentResume: { id: string; version: string; fileUrl: string; createdAt: string } | null;
  totalSubmissions: number;
  totalPlacements: number;
  premiumSkillFamilies: string[];
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

const TECH_CATEGORY_COLORS: Record<string, string> = {
  'ai-ml':            'bg-purple-100 text-purple-800 border-purple-200',
  'mlops-genai':      'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  'data-engineering': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  python:             'bg-yellow-100 text-yellow-800 border-yellow-200',
  sre:                'bg-rose-100 text-rose-800 border-rose-200',
  'cloud-devops':     'bg-sky-100 text-sky-800 border-sky-200',
  cybersecurity:      'bg-red-100 text-red-800 border-red-200',
  'data-analysis-bi': 'bg-teal-100 text-teal-800 border-teal-200',
  'java-full-stack':  'bg-orange-100 text-orange-800 border-orange-200',
  'dotnet-full-stack':'bg-blue-100 text-blue-800 border-blue-200',
};

const VISA_COLORS: Record<string, string> = {
  USC: 'bg-emerald-100 text-emerald-800',
  GC:  'bg-green-100 text-green-800',
  H1B: 'bg-blue-100 text-blue-800',
  OPT: 'bg-amber-100 text-amber-800',
  EAD: 'bg-violet-100 text-violet-800',
};

const DEFAULT_PILLS = [
  { key: 'all', label: 'All' },
  { key: 'ai-ml', label: 'AI/ML' },
  { key: 'mlops-genai', label: 'MLOps/GenAI' },
  { key: 'data-engineering', label: 'Data Engineering' },
  { key: 'python', label: 'Python' },
  { key: 'sre', label: 'SRE' },
  { key: 'cloud-devops', label: 'Cloud/DevOps' },
  { key: 'cybersecurity', label: 'Cybersecurity' },
  { key: 'data-analysis-bi', label: 'Data Analysis/BI' },
  { key: 'java-full-stack', label: 'Java Full Stack' },
  { key: 'dotnet-full-stack', label: '.NET Full Stack' },
];

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

export default function ConsultantsPanel() {
  const router = useRouter();
  const [techCategories, setTechCategories] = useState<TechCategory[]>([]);
  const [activeTech, setActiveTech] = useState('all');
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [visa, setVisa] = useState('ALL');
  const [availability, setAvailability] = useState('ALL');
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');
  const [sort, setSort] = useState('placeable');

  const fetchCategories = useCallback(async () => {
    try {
      const data = await api.get<TechCategory[]>('/bench-sales/tech-categories');
      setTechCategories(data);
    } catch { /* ignore */ }
  }, []);

  const fetchConsultants = useCallback(
    async (page = 1) => {
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: '25' });
        if (activeTech !== 'all') params.set('techCategory', activeTech);
        if (search) params.set('search', search);
        if (visa !== 'ALL') params.set('visa', visa);
        if (availability !== 'ALL') params.set('availability', availability);
        if (minRate) params.set('minRate', minRate);
        if (maxRate) params.set('maxRate', maxRate);
        if (sort) params.set('sort', sort);

        const result = await api.get<{ data: Consultant[]; total: number; page: number; pageSize: number; totalPages: number }>(
          `/bench-sales/consultants?${params.toString()}`,
        );
        setConsultants(result.data);
        setPagination({ page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages });
      } catch { /* handled */ } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTech, search, visa, availability, minRate, maxRate, sort],
  );

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { setLoading(true); fetchConsultants(1); }, [fetchConsultants]);

  const handleRefresh = () => { setRefreshing(true); fetchConsultants(pagination.page); };

  const pills =
    techCategories.length > 0
      ? [{ key: 'all', label: 'All' }, ...techCategories.map((tc) => ({ key: tc.key, label: tc.label }))]
      : DEFAULT_PILLS;

  if (loading && consultants.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {/* Refresh */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tech Category Pill Bar */}
      <div className="mb-6 flex flex-wrap gap-2">
        {pills.map((pill) => (
          <button
            key={pill.key}
            onClick={() => setActiveTech(pill.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTech === pill.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Filter Row */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
            placeholder="Search consultants, skills, email..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FunnelIcon className="h-4 w-4 text-gray-400" />
          <FilterSelect
            value={visa}
            onChange={setVisa}
            options={[
              { value: 'ALL', label: 'All Visa' },
              { value: 'USC', label: 'USC' },
              { value: 'GC', label: 'GC' },
              { value: 'H1B', label: 'H1B' },
              { value: 'OPT', label: 'OPT' },
              { value: 'EAD', label: 'EAD' },
            ]}
          />
          <FilterSelect
            value={availability}
            onChange={setAvailability}
            options={[
              { value: 'ALL', label: 'All Availability' },
              { value: 'IMMEDIATE', label: 'Immediate' },
              { value: '2WEEKS', label: '2 Weeks' },
              { value: '30DAYS', label: '30 Days' },
            ]}
          />
          <div className="flex items-center gap-1">
            <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
            <input
              type="number"
              value={minRate}
              onChange={(e) => setMinRate((e.target as HTMLInputElement).value)}
              placeholder="Min"
              className="w-20 rounded-lg border border-gray-300 py-2 px-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-xs text-gray-400">-</span>
            <input
              type="number"
              value={maxRate}
              onChange={(e) => setMaxRate((e.target as HTMLInputElement).value)}
              placeholder="Max"
              className="w-20 rounded-lg border border-gray-300 py-2 px-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <FilterSelect
            value={sort}
            onChange={setSort}
            options={[
              { value: 'placeable', label: 'Most Placeable' },
              { value: 'rate-desc', label: 'Highest Rate' },
              { value: 'newest', label: 'Newest' },
              { value: 'score', label: 'Best Score' },
            ]}
          />
        </div>
      </div>

      {/* Consultant Grid */}
      {consultants.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No consultants match your filters. Try widening your search criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {consultants.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-gray-900">{c.firstName} {c.lastName}</h3>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500">
                    <EnvelopeIcon className="h-3.5 w-3.5 shrink-0" />{c.email}
                  </p>
                </div>
                {c.visaBadge && (
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${VISA_COLORS[c.visaBadge] || 'bg-gray-100 text-gray-600'}`}>
                    {c.visaBadge}
                  </span>
                )}
              </div>
              {c.techCategories && c.techCategories.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {c.techCategories.map((tc) => (
                    <span key={tc.key} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${TECH_CATEGORY_COLORS[tc.key] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {tc.label}
                    </span>
                  ))}
                </div>
              )}
              {c.skills && c.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.skills.slice(0, 8).map((skill) => (
                    <span key={skill} className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">{skill}</span>
                  ))}
                  {c.skills.length > 8 && <span className="text-[10px] text-gray-400">+{c.skills.length - 8} more</span>}
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-600">
                {c.desiredRate !== null && (
                  <span className="flex items-center gap-1"><CurrencyDollarIcon className="h-3.5 w-3.5 text-gray-400" />${c.desiredRate}/hr</span>
                )}
                <span className="flex items-center gap-1"><CalendarDaysIcon className="h-3.5 w-3.5 text-gray-400" />{formatDate(c.availableFrom)}</span>
                <span className="flex items-center gap-1"><BriefcaseIcon className="h-3.5 w-3.5 text-gray-400" />{c.totalSubmissions} sub{c.totalSubmissions !== 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1"><StarIcon className="h-3.5 w-3.5 text-gray-400" />{c.totalPlacements} placed</span>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider"><TagIcon className="h-3 w-3" />Placeability</span>
                  <span className={`text-xs font-bold ${scoreTextColor(c.placeabilityScore)}`}>{c.placeabilityScore ?? '--'}/100</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${scoreColor(c.placeabilityScore)}`} style={{ width: `${c.placeabilityScore ?? 0}%` }} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider"><ShieldCheckIcon className="h-3 w-3" />Quality</span>
                <span className={`text-xs font-bold ${scoreTextColor(c.qualityScore)}`}>{c.qualityScore ?? '--'}/100</span>
              </div>
              <button
                onClick={() => router.push(`/dashboard/bench-sales/${c.id}`)}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
              >
                <UserIcon className="h-4 w-4" />View Profile
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <span className="text-xs text-gray-500">
            Showing {(pagination.page - 1) * pagination.pageSize + 1}&ndash;{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-1">
            <button onClick={() => fetchConsultants(pagination.page - 1)} disabled={pagination.page <= 1} className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button onClick={() => fetchConsultants(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
