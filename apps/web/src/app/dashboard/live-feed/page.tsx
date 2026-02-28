'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  ArrowPathIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InboxArrowDownIcon,
  ArrowTopRightOnSquareIcon,
  UserIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  StarIcon,
} from '@heroicons/react/24/outline';

const SOURCE_COLORS: Record<string, string> = {
  'Email Intel': 'bg-violet-100 text-violet-700 border-violet-200',
  JSEARCH: 'bg-blue-100 text-blue-700 border-blue-200',
  JSearch: 'bg-blue-100 text-blue-700 border-blue-200',
  DICE: 'bg-green-100 text-green-700 border-green-200',
  Dice: 'bg-green-100 text-green-700 border-green-200',
  ARBEITNOW: 'bg-orange-100 text-orange-700 border-orange-200',
  Arbeitnow: 'bg-orange-100 text-orange-700 border-orange-200',
  REMOTEOK: 'bg-teal-100 text-teal-700 border-teal-200',
  RemoteOK: 'bg-teal-100 text-teal-700 border-teal-200',
  GREENHOUSE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  LEVER: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  OTHER: 'bg-gray-100 text-gray-700 border-gray-200',
};

const TIER_COLORS: Record<string, string> = {
  MEGA: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white',
  ELITE: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white',
  PREMIUM: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
  HIGH: 'bg-emerald-100 text-emerald-800',
  STANDARD: 'bg-gray-100 text-gray-700',
};

const TIER_LABELS: Record<string, string> = {
  MEGA: '$400K+ Base',
  ELITE: '$300K–$400K Base',
  PREMIUM: '$250K–$300K Base',
  HIGH: '$200K–$250K Base',
  STANDARD: '< $200K Base',
};

const EMP_COLORS: Record<string, string> = {
  C2C: 'bg-emerald-100 text-emerald-800',
  W2: 'bg-blue-100 text-blue-800',
  CONTRACT: 'bg-amber-100 text-amber-800',
  C2H: 'bg-purple-100 text-purple-800',
  CONTRACTOR: 'bg-amber-100 text-amber-800',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmt(n: number | undefined | null): string {
  if (n == null) return '0';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

function emailUsername(email: string): string {
  if (!email) return '';
  return email.split('@')[0] || email;
}

type EmpFilter = 'ALL' | 'C2C' | 'W2' | 'CONTRACT' | 'C2H';
type FeedTab = 'email' | 'boards' | 'highpaid';
type CompTier = 'ALL' | 'MEGA' | 'ELITE' | 'PREMIUM' | 'HIGH';

export default function LiveFeedPage() {
  const [data, setData] = useState<any>(null);
  const [highPaidData, setHighPaidData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [highPaidLoading, setHighPaidLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [empFilter, setEmpFilter] = useState<EmpFilter>('ALL');
  const [compTierFilter, setCompTierFilter] = useState<CompTier>('ALL');
  const [activeTab, setActiveTab] = useState<FeedTab>('email');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [nextRefreshIn, setNextRefreshIn] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get('/analytics/live-feed?hours=24&limit=500');
      setData(d);
      setLastRefresh(new Date());
      setNextRefreshIn(60);
    } catch (err) {
      console.error('Failed to load live feed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHighPaid = useCallback(async () => {
    setHighPaidLoading(true);
    try {
      const d = await api.get('/analytics/high-paid-feed?minSalary=200000&limit=300');
      setHighPaidData(d);
    } catch (err) {
      console.error('Failed to load high-paid feed', err);
    } finally {
      setHighPaidLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadHighPaid();
    timerRef.current = setInterval(() => { load(); loadHighPaid(); }, 60 * 60 * 1000);
    countdownRef.current = setInterval(() => {
      setNextRefreshIn(prev => (prev <= 1 ? 60 : prev - 1));
    }, 60 * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [load, loadHighPaid]);

  const allJobs: any[] = data?.jobs || [];
  const highPaidJobs: any[] = highPaidData?.jobs || [];

  const emailJobs = useMemo(() => allJobs.filter((j: any) => j.source === 'Email Intel'), [allJobs]);
  const boardJobs = useMemo(() => allJobs.filter((j: any) => j.source !== 'Email Intel'), [allJobs]);

  const currentPool = activeTab === 'email' ? emailJobs : activeTab === 'boards' ? boardJobs : highPaidJobs;

  const filtered = useMemo(() => currentPool.filter((j: any) => {
    if (activeTab !== 'highpaid' && empFilter !== 'ALL' && j.employmentType !== empFilter) return false;
    if (activeTab === 'highpaid' && compTierFilter !== 'ALL' && j.tier !== compTierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (j.title || '').toLowerCase().includes(q) ||
        (j.company || '').toLowerCase().includes(q) ||
        (j.location || '').toLowerCase().includes(q) ||
        (j.receivedByEmail || '').toLowerCase().includes(q) ||
        (j.fromEmail || '').toLowerCase().includes(q) ||
        (j.skills || []).some((s: string) => s.toLowerCase().includes(q))
      );
    }
    return true;
  }), [currentPool, empFilter, compTierFilter, search, activeTab]);

  const stats: any[] = data?.stats || [];
  const c2cCount = stats.find((s: any) => s.type === 'C2C')?.count || 0;
  const w2Count = stats.find((s: any) => s.type === 'W2')?.count || 0;
  const contractCount = stats.find((s: any) => s.type === 'CONTRACT')?.count || 0;
  const c2hCount = stats.find((s: any) => s.type === 'C2H')?.count || 0;

  const boardSourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    boardJobs.forEach((j: any) => {
      const src = j.source || 'Unknown';
      counts[src] = (counts[src] || 0) + 1;
    });
    return counts;
  }, [boardJobs]);

  const emailMailboxCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    emailJobs.forEach((j: any) => {
      const mb = j.receivedByEmail || 'Unknown';
      counts[mb] = (counts[mb] || 0) + 1;
    });
    return counts;
  }, [emailJobs]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Live Job Feed"
        description="C2C / W2 / Contract openings from the last 24 hours — all sources combined"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <ClockIcon className="h-3.5 w-3.5" />
              <span>Refreshes in {nextRefreshIn}m</span>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Now
            </button>
          </div>
        }
      />

      {/* Stats Bar */}
      {activeTab !== 'highpaid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            onClick={() => setEmpFilter(empFilter === 'C2C' ? 'ALL' : 'C2C')}
            className={`rounded-xl border-2 p-3 text-center transition-all ${
              empFilter === 'C2C'
                ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                : 'border-emerald-200 bg-emerald-50 hover:border-emerald-300'
            }`}
          >
            <p className="text-2xl font-bold text-emerald-700">{fmt(c2cCount)}</p>
            <p className="text-[10px] font-medium text-emerald-600">C2C</p>
          </button>
          <button
            onClick={() => setEmpFilter(empFilter === 'W2' ? 'ALL' : 'W2')}
            className={`rounded-xl border-2 p-3 text-center transition-all ${
              empFilter === 'W2'
                ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                : 'border-blue-200 bg-blue-50 hover:border-blue-300'
            }`}
          >
            <p className="text-2xl font-bold text-blue-700">{fmt(w2Count)}</p>
            <p className="text-[10px] font-medium text-blue-600">W2</p>
          </button>
          <button
            onClick={() => setEmpFilter(empFilter === 'CONTRACT' ? 'ALL' : 'CONTRACT')}
            className={`rounded-xl border-2 p-3 text-center transition-all ${
              empFilter === 'CONTRACT'
                ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                : 'border-amber-200 bg-amber-50 hover:border-amber-300'
            }`}
          >
            <p className="text-2xl font-bold text-amber-700">{fmt(contractCount)}</p>
            <p className="text-[10px] font-medium text-amber-600">Contract</p>
          </button>
          <button
            onClick={() => setEmpFilter(empFilter === 'C2H' ? 'ALL' : 'C2H')}
            className={`rounded-xl border-2 p-3 text-center transition-all ${
              empFilter === 'C2H'
                ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200'
                : 'border-purple-200 bg-purple-50 hover:border-purple-300'
            }`}
          >
            <p className="text-2xl font-bold text-purple-700">{fmt(c2hCount)}</p>
            <p className="text-[10px] font-medium text-purple-600">C2H</p>
          </button>
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{fmt(filtered.length)}</p>
            <p className="text-[10px] text-gray-500 font-medium">Showing</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {(highPaidData?.compBuckets || []).map((b: any) => {
            const tierKey = b.label.includes('500') ? 'MEGA' : b.label.includes('400') ? 'ELITE' : b.label.includes('300') ? 'PREMIUM' : 'HIGH';
            const isActive = compTierFilter === tierKey;
            const borderColor = tierKey === 'MEGA' ? 'border-yellow-400' : tierKey === 'ELITE' ? 'border-purple-400' : tierKey === 'PREMIUM' ? 'border-blue-400' : 'border-emerald-400';
            const bgColor = tierKey === 'MEGA' ? 'bg-yellow-50' : tierKey === 'ELITE' ? 'bg-purple-50' : tierKey === 'PREMIUM' ? 'bg-blue-50' : 'bg-emerald-50';
            const textColor = tierKey === 'MEGA' ? 'text-yellow-700' : tierKey === 'ELITE' ? 'text-purple-700' : tierKey === 'PREMIUM' ? 'text-blue-700' : 'text-emerald-700';
            return (
              <button
                key={b.label}
                onClick={() => setCompTierFilter(isActive ? 'ALL' : tierKey as CompTier)}
                className={`rounded-xl border-2 p-3 text-center transition-all ${
                  isActive ? `${borderColor} ${bgColor} ring-2 ring-offset-1` : `${borderColor} ${bgColor} hover:ring-1`
                }`}
              >
                <p className={`text-2xl font-bold ${textColor}`}>{b.count}</p>
                <p className={`text-[10px] font-medium ${textColor}`}>{b.label}</p>
              </button>
            );
          })}
          {highPaidData?.avgOpportunityScore > 0 && (
            <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-3 text-center">
              <p className="text-2xl font-bold text-indigo-700">{highPaidData.avgOpportunityScore}</p>
              <p className="text-[10px] font-medium text-indigo-600">Avg Score</p>
            </div>
          )}
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{fmt(filtered.length)}</p>
            <p className="text-[10px] text-gray-500 font-medium">Showing</p>
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
        <button
          onClick={() => { setActiveTab('email'); setExpandedId(null); setVisibleCount(50); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'email'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <EnvelopeIcon className="h-4 w-4" />
          Email Intel
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            activeTab === 'email' ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'
          }`}>
            {emailJobs.length}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('boards'); setExpandedId(null); setVisibleCount(50); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'boards'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <GlobeAltIcon className="h-4 w-4" />
          Job Boards
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            activeTab === 'boards' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
          }`}>
            {boardJobs.length}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('highpaid'); setExpandedId(null); setVisibleCount(50); setCompTierFilter('ALL'); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'highpaid'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <BanknotesIcon className="h-4 w-4" />
          High-Paid
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            activeTab === 'highpaid' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
          }`}>
            {highPaidJobs.length}
          </span>
        </button>
      </div>

      {/* Tab-specific source breakdown */}
      {activeTab === 'email' && Object.keys(emailMailboxCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(emailMailboxCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([mailbox, count]) => (
              <span
                key={mailbox}
                className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700"
              >
                <InboxArrowDownIcon className="h-3 w-3" />
                {emailUsername(mailbox)}: {count}
              </span>
            ))}
        </div>
      )}
      {activeTab === 'boards' && Object.keys(boardSourceCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(boardSourceCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([source, count]) => (
              <span
                key={source}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  SOURCE_COLORS[source] || 'bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                <GlobeAltIcon className="h-3 w-3" />
                {source}: {count}
              </span>
            ))}
        </div>
      )}
      {activeTab === 'highpaid' && (highPaidData?.topCompanies || []).length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {(highPaidData.topCompanies as any[]).slice(0, 20).map((c: any) => (
              <span
                key={c.company}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700"
              >
                <BuildingOffice2Icon className="h-3 w-3" />
                {c.company}: {c.count}
              </span>
            ))}
          </div>
          {highPaidData?.compIntelSummary && (
            <div className="flex flex-wrap gap-3 text-[10px]">
              <span className="inline-flex items-center gap-1 rounded-md bg-green-50 border border-green-200 px-2 py-1 text-green-700 font-medium">
                {highPaidData.compIntelSummary.baseSalaryRoles} verified base salary
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 border border-orange-200 px-2 py-1 text-orange-700 font-medium">
                {highPaidData.compIntelSummary.totalCompRoles} estimated from total comp
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-1 text-indigo-700 font-medium">
                {highPaidData.compIntelSummary.withEquity} with equity mentioned
              </span>
            </div>
          )}
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'highpaid'
              ? 'Search company, role, location, skills...'
              : activeTab === 'email'
                ? 'Search title, company, location, skills, mailbox...'
                : 'Search title, company, location, skills...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        {activeTab !== 'highpaid' ? (
          <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
            {(['ALL', 'C2C', 'W2', 'CONTRACT', 'C2H'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setEmpFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  empFilter === f
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex rounded-lg border border-amber-300 bg-white p-0.5">
            {(['ALL', 'MEGA', 'ELITE', 'PREMIUM', 'HIGH'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCompTierFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  compTierFilter === f
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f === 'ALL' ? 'ALL' : TIER_LABELS[f] || f}
              </button>
            ))}
          </div>
        )}
        <span className="text-xs text-gray-400">
          Last refreshed: {lastRefresh.toLocaleTimeString()}
        </span>
      </div>

      {/* Loading */}
      {((activeTab !== 'highpaid' && loading && !data) || (activeTab === 'highpaid' && highPaidLoading && !highPaidData)) && (
        <div className="flex items-center justify-center py-20">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Job Cards — Standard (Email Intel / Job Boards) */}
      {activeTab !== 'highpaid' && data && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center text-sm text-gray-500">
              {activeTab === 'email'
                ? 'No email intel jobs match your filters'
                : 'No job board openings match your filters'}
            </div>
          ) : (
            filtered.slice(0, visibleCount).map((job: any) => (
              <div
                key={job.id}
                className="rounded-xl border border-gray-200 bg-white hover:shadow-sm transition-shadow"
              >
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                >
                  <div className="shrink-0 mt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold ${
                        SOURCE_COLORS[job.source] || 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {job.source === 'Email Intel' ? (
                        <EnvelopeIcon className="h-3 w-3" />
                      ) : (
                        <GlobeAltIcon className="h-3 w-3" />
                      )}
                      {job.source}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          EMP_COLORS[job.employmentType] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {job.employmentType}
                      </span>
                      <h3 className="font-medium text-gray-900 text-sm truncate">{job.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="font-medium text-gray-700">{job.company}</span>
                      {job.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPinIcon className="h-3 w-3" />
                          {job.location}
                        </span>
                      )}
                      {job.rateText && (
                        <span className="flex items-center gap-0.5 text-green-700 font-medium">
                          <CurrencyDollarIcon className="h-3 w-3" />
                          {job.rateText}
                        </span>
                      )}
                    </div>
                    {job.source === 'Email Intel' && job.receivedByEmail && (
                      <div className="flex items-center gap-3 mt-1 text-[11px]">
                        <span className="flex items-center gap-1 text-violet-600">
                          <InboxArrowDownIcon className="h-3 w-3" />
                          {job.receivedByEmail}
                        </span>
                        {job.fromEmail && (
                          <span className="flex items-center gap-1 text-gray-500">
                            <UserIcon className="h-3 w-3" />
                            from {job.fromName ? `${job.fromName} <${job.fromEmail}>` : job.fromEmail}
                          </span>
                        )}
                      </div>
                    )}
                    {job.source !== 'Email Intel' && (job.applyUrl || job.sourceUrl) && (
                      <div className="flex items-center gap-2 mt-1 text-[11px]">
                        <a
                          href={job.applyUrl || job.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                          View Original Posting
                        </a>
                      </div>
                    )}
                    {job.skills && job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {job.skills.slice(0, 6).map((s: string) => (
                          <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{s}</span>
                        ))}
                        {job.skills.length > 6 && <span className="text-[10px] text-gray-400">+{job.skills.length - 6}</span>}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    <span className="text-[10px] text-gray-400">{timeAgo(job.receivedAt)}</span>
                    {job.actionabilityScore != null && job.actionabilityScore > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-10 rounded-full bg-gray-200">
                          <div
                            className={`h-1.5 rounded-full ${
                              job.actionabilityScore >= 70 ? 'bg-emerald-500' : job.actionabilityScore >= 40 ? 'bg-amber-500' : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(job.actionabilityScore, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500">{job.actionabilityScore}</span>
                      </div>
                    )}
                    {expandedId === job.id ? <ChevronUpIcon className="h-4 w-4 text-gray-400" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>
                {expandedId === job.id && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 text-xs space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {job.source === 'Email Intel' ? (
                        <>
                          <div><p className="font-medium text-gray-700">Received By</p><p className="text-violet-600 font-medium">{job.receivedByEmail || '—'}</p></div>
                          <div><p className="font-medium text-gray-700">From</p><p className="text-gray-500">{job.fromName || '—'}</p><p className="text-indigo-600">{job.fromEmail || '—'}</p></div>
                          <div><p className="font-medium text-gray-700">Vendor</p><p className="text-gray-500">{job.vendorDomain || '—'}</p></div>
                          <div><p className="font-medium text-gray-700">Vendor Trust</p><p className="text-gray-500">{job.vendorTrust || 0}/100</p></div>
                          <div><p className="font-medium text-gray-700">Contact</p><p className="text-gray-500">{job.contactName || '—'}</p><p className="text-indigo-600">{job.contactEmail || '—'}</p></div>
                          <div><p className="font-medium text-gray-700">Engagement</p><p className="text-gray-500">{job.engagementModel || '—'}</p></div>
                        </>
                      ) : (
                        <>
                          <div><p className="font-medium text-gray-700">Source</p><p className="text-blue-600 font-medium">{job.source}</p></div>
                          <div><p className="font-medium text-gray-700">Company</p><p className="text-gray-500">{job.vendorDomain || job.company || '—'}</p></div>
                          <div><p className="font-medium text-gray-700">Recruiter</p><p className="text-gray-500">{job.contactName || '—'}</p><p className="text-indigo-600">{job.contactEmail || '—'}</p></div>
                          <div><p className="font-medium text-gray-700">Realness Score</p><p className="text-gray-500">{job.vendorTrust || 0}/100</p></div>
                          {(job.applyUrl || job.sourceUrl) && (
                            <div className="col-span-2">
                              <p className="font-medium text-gray-700 mb-1">Links</p>
                              <div className="flex gap-3">
                                {job.applyUrl && <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline"><ArrowTopRightOnSquareIcon className="h-3 w-3" />Apply</a>}
                                {job.sourceUrl && <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline"><GlobeAltIcon className="h-3 w-3" />Source</a>}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {job.skills && job.skills.length > 0 && (
                      <div>
                        <p className="font-medium text-gray-700 mb-1">All Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {job.skills.map((s: string) => (
                            <span key={s} className="rounded bg-indigo-50 text-indigo-700 px-1.5 py-0.5 text-[10px] font-medium">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {filtered.length > visibleCount && (
            <button
              onClick={() => setVisibleCount(prev => prev + 50)}
              className="mt-2 w-full rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              Show more ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}

      {/* Job Cards — High-Paid FAANG/Tech */}
      {activeTab === 'highpaid' && (highPaidData || highPaidLoading) && (
        <div className="space-y-2">
          {!highPaidLoading && filtered.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-12 text-center">
              <BanknotesIcon className="mx-auto h-10 w-10 text-amber-400 mb-3" />
              <p className="text-sm font-medium text-amber-800">No high-paid roles match your filters</p>
              <p className="text-xs text-amber-600 mt-1">High-paid roles are crawled from FAANG & top tech company career pages hourly</p>
            </div>
          ) : (
            filtered.slice(0, visibleCount).map((job: any) => (
              <div
                key={job.id}
                className={`rounded-xl border-2 bg-white hover:shadow-md transition-all ${
                  job.tier === 'MEGA' ? 'border-yellow-300 shadow-yellow-100/50' :
                  job.tier === 'ELITE' ? 'border-purple-300 shadow-purple-100/50' :
                  job.tier === 'PREMIUM' ? 'border-blue-200' :
                  'border-emerald-200'
                }`}
              >
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                >
                  {/* Left: Comp + Score */}
                  <div className="shrink-0 mt-0.5 flex flex-col items-center gap-1.5 min-w-[80px]">
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold shadow-sm ${TIER_COLORS[job.tier] || 'bg-gray-100 text-gray-700'}`}>
                      <BanknotesIcon className="h-3.5 w-3.5" />
                      {job.compDisplay || 'N/A'}
                    </span>
                    {job.opportunityScore > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-10 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div className={`h-full rounded-full ${
                            job.opportunityScore >= 80 ? 'bg-green-500' :
                            job.opportunityScore >= 60 ? 'bg-blue-500' : 'bg-gray-400'
                          }`} style={{ width: `${job.opportunityScore}%` }} />
                        </div>
                        <span className="text-[9px] font-bold text-gray-500">{job.opportunityScore}</span>
                      </div>
                    )}
                    {job.isFaang && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600">
                        <StarIcon className="h-3 w-3" /> FAANG+
                      </span>
                    )}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 text-sm">{job.title}</h3>
                      {job.compType === 'BASE' && (
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-green-100 text-green-700 border border-green-200">VERIFIED BASE</span>
                      )}
                      {job.compType === 'TOTAL' && (
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200">EST. BASE</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-gray-800">
                        <BuildingOffice2Icon className="h-3.5 w-3.5 text-gray-600" />
                        {job.company}
                      </span>
                      {job.companyTier && (
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                          job.companyTier === 'FAANG' ? 'bg-amber-100 text-amber-700' :
                          job.companyTier === 'AI_INFRA' ? 'bg-purple-100 text-purple-700' :
                          job.companyTier === 'MEGA_TECH' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {job.companyTier === 'FAANG' ? 'FAANG' : job.companyTier === 'AI_INFRA' ? 'AI/Infra' : job.companyTier === 'MEGA_TECH' ? 'Enterprise' : 'High Growth'}
                        </span>
                      )}
                      {job.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPinIcon className="h-3 w-3" />
                          {job.location}
                        </span>
                      )}
                      {job.locationType && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          job.locationType === 'REMOTE' ? 'bg-teal-100 text-teal-700' :
                          job.locationType === 'HYBRID' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {job.locationType}
                        </span>
                      )}
                    </div>
                    {job.applyUrl && (
                      <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                        <a
                          href={job.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 rounded-md bg-indigo-600 px-3 py-1 text-white font-medium hover:bg-indigo-700 transition-colors"
                        >
                          <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                          Apply Now
                        </a>
                        <span className="text-gray-400">
                          via {job.faangSource === 'GREENHOUSE' || job.faangSource === 'LEVER' ? 'Career Page' : job.source || 'Direct'}
                        </span>
                      </div>
                    )}
                    {job.skills && job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {job.skills.slice(0, 8).map((s: string) => (
                          <span key={s} className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] text-amber-700 font-medium">{s}</span>
                        ))}
                        {job.skills.length > 8 && <span className="text-[10px] text-gray-400">+{job.skills.length - 8}</span>}
                      </div>
                    )}
                  </div>

                  {/* Right side: comp breakdown */}
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    <span className="text-[10px] text-gray-400">{timeAgo(job.postedAt)}</span>
                    {job.baseMin > 0 && job.baseMax > 0 && (
                      <div className="text-right">
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider">Base</p>
                        <p className="text-xs font-bold text-green-700">${Math.round(job.baseMin / 1000)}K – ${Math.round(job.baseMax / 1000)}K</p>
                      </div>
                    )}
                    {job.totalCompDisplay && (
                      <div className="text-right mt-0.5">
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider">Est. Total</p>
                        <p className="text-[11px] font-semibold text-indigo-600">{job.totalCompDisplay}</p>
                      </div>
                    )}
                    {expandedId === job.id ? <ChevronUpIcon className="h-4 w-4 text-gray-400" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded Detail */}
                {expandedId === job.id && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gradient-to-b from-gray-50/80 to-white text-xs space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <p className="font-medium text-gray-700">Company</p>
                        <p className="text-gray-900 font-semibold">{job.company}</p>
                        {job.companyDomain && <p className="text-gray-400">{job.companyDomain}</p>}
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Base Salary</p>
                        <p className="text-green-700 font-bold text-sm">{job.compDisplay}</p>
                        {job.compType === 'BASE' && <p className="text-[10px] text-green-600">From job posting (CA/NY/CO disclosure)</p>}
                        {job.compType === 'TOTAL' && <p className="text-[10px] text-orange-600">Estimated from total comp disclosure</p>}
                      </div>
                      {job.totalMin > 0 && job.totalMax > 0 && (
                        <div>
                          <p className="font-medium text-gray-700">Est. Total Comp</p>
                          <p className="text-indigo-700 font-bold text-sm">${Math.round(job.totalMin / 1000)}K – ${Math.round(job.totalMax / 1000)}K</p>
                          <p className="text-[10px] text-gray-400">{job.hasEquity ? 'Includes RSU/stock' : 'Base + est. bonus'}</p>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-700">Location</p>
                        <p className="text-gray-600">{job.location || '—'}</p>
                        {job.locationType && <span className="text-gray-400">{job.locationType}</span>}
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Opportunity Score</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="w-16 h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div className={`h-full rounded-full ${
                              job.opportunityScore >= 80 ? 'bg-green-500' :
                              job.opportunityScore >= 60 ? 'bg-blue-500' : 'bg-gray-400'
                            }`} style={{ width: `${job.opportunityScore}%` }} />
                          </div>
                          <span className="text-sm font-bold text-gray-700">{job.opportunityScore}/100</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2 border-t border-gray-100">
                      {job.applyUrl && (
                        <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 transition-colors">
                          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" /> Apply Now
                        </a>
                      )}
                      {job.sourceUrl && job.sourceUrl !== job.applyUrl && (
                        <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                          <GlobeAltIcon className="h-3.5 w-3.5" /> View Source
                        </a>
                      )}
                    </div>
                    {job.skills && job.skills.length > 0 && (
                      <div>
                        <p className="font-medium text-gray-700 mb-1">Skills & Technologies</p>
                        <div className="flex flex-wrap gap-1">
                          {job.skills.map((s: string) => (
                            <span key={s} className="rounded bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 text-[10px] font-medium">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {filtered.length > visibleCount && (
            <button
              onClick={() => setVisibleCount(prev => prev + 50)}
              className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            >
              Show more ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
