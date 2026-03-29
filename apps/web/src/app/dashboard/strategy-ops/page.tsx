'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { Modal } from '@/components/modal';
import {
  ArrowPathIcon,
  SparklesIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  AdjustmentsHorizontalIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BuildingOfficeIcon,
  AcademicCapIcon,
  BoltIcon,
  SignalIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MapPinIcon,
  EnvelopeIcon,
  ClockIcon,
  PaperAirplaneIcon,
  UserIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { ClickableMetric, StaticDrillDownModal } from '@/components/drill-down-modal';

function ScoreBadge({ score, label }: { score: number | null; label?: string }) {
  if (score == null) return null;
  const s = typeof score === 'number' ? score : 0;
  const color = s >= 80 ? 'bg-green-100 text-green-800' : s >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label || s}</span>;
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    PRIME: 'bg-emerald-100 text-emerald-800',
    DIRECT: 'bg-blue-100 text-blue-800',
    SUB: 'bg-yellow-100 text-yellow-800',
    BROKER: 'bg-orange-100 text-orange-800',
    UNCLASSIFIED: 'bg-gray-100 text-gray-600',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[tier] || 'bg-gray-100 text-gray-600'}`}>{tier}</span>;
}

function LaneBadge({ lane }: { lane: string }) {
  const colors: Record<string, string> = {
    PRIME_C2C: 'bg-emerald-100 text-emerald-800',
    BROAD_C2C_W2: 'bg-blue-100 text-blue-800',
    FTE_HIGH_COMP: 'bg-purple-100 text-purple-800',
    OPT_JUNIOR_FTE: 'bg-amber-100 text-amber-800',
    UNASSIGNED: 'bg-gray-100 text-gray-600',
  };
  const labels: Record<string, string> = {
    PRIME_C2C: 'Lane 1: Prime C2C',
    BROAD_C2C_W2: 'Lane 2: Broad C2C/W2',
    FTE_HIGH_COMP: 'Lane 3: FTE High-Comp',
    OPT_JUNIOR_FTE: 'Lane 4: OPT/Junior',
    UNASSIGNED: 'Unassigned',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${colors[lane] || 'bg-gray-100 text-gray-600'}`}>{labels[lane] || lane}</span>;
}

function ProgressBar({ value, max, color = 'bg-indigo-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-gray-100">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StrategyOpsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [supplyDemand, setSupplyDemand] = useState<any>(null);
  const [techTiers, setTechTiers] = useState<any[]>([]);
  const [lanePerf, setLanePerf] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [computingQuality, setComputingQuality] = useState(false);
  const [qualityResult, setQualityResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'lanes' | 'tech' | 'supply'>('overview');
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [familyReqs, setFamilyReqs] = useState<any[]>([]);
  const [familyReqsLoading, setFamilyReqsLoading] = useState(false);
  const [familyReqsPage, setFamilyReqsPage] = useState(1);
  const [familyReqsPagination, setFamilyReqsPagination] = useState<any>(null);

  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  // Auto-refresh
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [nextRefreshIn, setNextRefreshIn] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Filters for expanded req list
  const [filterLocation, setFilterLocation] = useState('');
  const [filterEngModel, setFilterEngModel] = useState('ALL');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterMinRate, setFilterMinRate] = useState('');
  const [filterMaxRate, setFilterMaxRate] = useState('');
  const [filterLocations, setFilterLocations] = useState<string[]>([]);
  const [filterEngModels, setFilterEngModels] = useState<{ model: string; count: number }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, sd, tt, lp] = await Promise.allSettled([
        api.get<any>('/strategy-ops/overview'),
        api.get<any>('/strategy-ops/supply-demand'),
        api.get<any[]>('/strategy-ops/tech-tier-analytics'),
        api.get<any>('/strategy-ops/lane-performance'),
      ]);
      if (ov.status === 'fulfilled') setOverview(ov.value);
      if (sd.status === 'fulfilled') setSupplyDemand(sd.value);
      if (tt.status === 'fulfilled') setTechTiers(tt.value);
      if (lp.status === 'fulfilled') setLanePerf(lp.value);
      setLastRefresh(new Date());
      setNextRefreshIn(60);
    } catch (err) {
      console.error('Strategy ops fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(() => { fetchData(); }, 60 * 60 * 1000);
    countdownRef.current = setInterval(() => {
      setNextRefreshIn(prev => (prev <= 1 ? 60 : prev - 1));
    }, 60 * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchData]);

  const loadFamilyReqs = useCallback(async (
    family: string | null,
    page = 1,
    filters?: { location?: string; engagementModel?: string; search?: string; minRate?: string; maxRate?: string },
  ) => {
    if (!family) {
      setExpandedFamily(null);
      setFamilyReqs([]);
      setFamilyReqsPagination(null);
      return;
    }
    setFamilyReqsLoading(true);
    try {
      const qs = new URLSearchParams({
        family,
        page: String(page),
        pageSize: '15',
      });
      if (filters?.location) qs.set('location', filters.location);
      if (filters?.engagementModel && filters.engagementModel !== 'ALL') qs.set('engagementModel', filters.engagementModel);
      if (filters?.search) qs.set('search', filters.search);
      if (filters?.minRate) qs.set('minRate', filters.minRate);
      if (filters?.maxRate) qs.set('maxRate', filters.maxRate);

      const r = await api.get<any>(`/strategy-ops/reqs-by-family?${qs}`);
      setFamilyReqs(r.data || []);
      setFamilyReqsPagination(r.pagination || null);
      setFamilyReqsPage(page);
      setExpandedFamily(family);
      if (r.filterOptions) {
        setFilterLocations(r.filterOptions.locations || []);
        setFilterEngModels(r.filterOptions.engagementModels || []);
      }
    } catch (err) {
      console.error('Failed to load reqs for family:', err);
    } finally {
      setFamilyReqsLoading(false);
    }
  }, []);

  const handleTierClick = (family: string | null) => {
    if (expandedFamily === family) {
      setExpandedFamily(null);
      setFamilyReqs([]);
    } else {
      setFilterLocation('');
      setFilterEngModel('ALL');
      setFilterSearch('');
      setFilterMinRate('');
      setFilterMaxRate('');
      loadFamilyReqs(family || 'OTHER');
    }
  };

  const applyFilters = () => {
    if (!expandedFamily) return;
    loadFamilyReqs(expandedFamily, 1, {
      location: filterLocation,
      engagementModel: filterEngModel,
      search: filterSearch,
      minRate: filterMinRate,
      maxRate: filterMaxRate,
    });
  };

  const openReqDetail = async (req: any) => {
    setSelectedReq(req);
    setMatchData(null);
    setSubmitResult(null);
    setMatchLoading(true);
    try {
      const d = await api.get<any>(`/mail-intel/req-signals/${req.id}/matches`);
      setMatchData(d);
    } catch (err) {
      console.error('Failed to load matches:', err);
      setMatchData({ topMatches: [] });
    } finally {
      setMatchLoading(false);
    }
  };

  const handleSubmitConsultant = async (consultantId: string, consultantName: string) => {
    if (!selectedReq) return;
    setSubmitting(consultantId);
    setSubmitResult(null);
    try {
      await api.post('/submissions/from-req-signal', {
        reqSignalId: selectedReq.id,
        consultantId,
        notes: `[Strategy Ops] Applied via Tech Tier drill-down for: ${selectedReq.title}`,
      });
      setSubmitResult({ success: true, message: `Submission created for ${consultantName} → ${selectedReq.title}` });
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Submission failed';
      setSubmitResult({ success: false, message: msg });
    } finally {
      setSubmitting(null);
    }
  };

  const handleComputeQuality = async () => {
    setComputingQuality(true);
    setQualityResult(null);
    try {
      const r = await api.post<any>('/strategy-ops/compute-quality-scores');
      setQualityResult(`Updated ${r.updated} consultant quality scores`);
      fetchData();
    } catch (err: any) {
      setQualityResult(`Error: ${err.message}`);
    } finally {
      setComputingQuality(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Strategic Overview', icon: ChartBarIcon },
    { id: 'lanes', label: 'Sourcing Lanes', icon: AdjustmentsHorizontalIcon },
    { id: 'tech', label: 'Tech Tiers', icon: SparklesIcon },
    { id: 'supply', label: 'Supply-Demand', icon: SignalIcon },
  ] as const;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategy Operations"
        description="Supply-aware priority engine, four sourcing lanes, technology tiers, and pre-submission quality gates"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <ClockIcon className="h-3.5 w-3.5" />
              <span>Refreshes in {nextRefreshIn}m</span>
              <span className="text-gray-300">|</span>
              <span>Last: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <button
              onClick={handleComputeQuality}
              disabled={computingQuality}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <BoltIcon className="h-4 w-4" />
              {computingQuality ? 'Computing...' : 'Compute Quality Scores'}
            </button>
            <button onClick={fetchData} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {qualityResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircleIcon className="mr-1 inline h-4 w-4" /> {qualityResult}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <ClickableMetric metric="vendorReqSignals">
              <KpiCard title="Total Req Signals" value={overview.pipeline?.totalSignals?.toLocaleString() || '0'} subtitle="from email extraction" icon={SignalIcon} />
            </ClickableMetric>
            <ClickableMetric metric="qualityReqs">
              <KpiCard title="Premium Signals" value={`${overview.pipeline?.premiumSignals?.toLocaleString() || '0'} (${overview.pipeline?.premiumPct}%)`} subtitle="AI/ML, MLOps, Data Eng" icon={SparklesIcon} />
            </ClickableMetric>
            <ClickableMetric metric="vendorCompanies">
              <KpiCard title="Prime Vendors" value={`${overview.vendors?.prime || 0} / ${overview.vendors?.total || 0}`} subtitle="PRIME + DIRECT tier" icon={BuildingOfficeIcon} />
            </ClickableMetric>
            <ClickableMetric metric="allConsultants">
              <KpiCard title="Ready Consultants" value={`${overview.supply?.ready || 0} / ${overview.supply?.total || 0}`} subtitle="SUBMISSION_READY + VERIFIED" icon={UserGroupIcon} />
            </ClickableMetric>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ClickableMetric metric="submissions">
              <KpiCard title="Submissions (30d)" value={String(overview.submissions?.last30d || 0)} subtitle={`${overview.submissions?.total || 0} lifetime`} icon={CurrencyDollarIcon} />
            </ClickableMetric>
            <ClickableMetric metric="vendorReqSignals">
              <KpiCard
                title="Tech Tiers Configured"
                value={String(overview.configuration?.techTiers || 0)}
                subtitle={`${overview.configuration?.optEmployers || 0} OPT employers indexed`}
                icon={AcademicCapIcon}
              />
            </ClickableMetric>
          </div>

          {/* Conversion Funnel */}
          {overview.submissions?.funnel && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-base font-semibold text-gray-900">Conversion Funnel</h3>
              <div className="grid grid-cols-4 gap-4">
                {(['submitted', 'interviewing', 'offered', 'accepted'] as const).map((stage) => {
                  const val = overview.submissions.funnel[stage] || 0;
                  const colors: Record<string, string> = { submitted: 'bg-blue-500', interviewing: 'bg-yellow-500', offered: 'bg-purple-500', accepted: 'bg-green-500' };
                  return (
                    <div key={stage} className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{val}</p>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{stage}</p>
                      <div className="mx-auto mt-2 h-1.5 w-full max-w-[80px] rounded-full bg-gray-100">
                        <div className={`h-1.5 rounded-full ${colors[stage]}`} style={{ width: `${Math.min(100, val * 10)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Operating Rules */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-gray-900">Operating Rules (Hard Filters)</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                { rule: 'Trust-first: Vendor trust >= 30 required for auto-submit', icon: ShieldCheckIcon, color: 'text-emerald-600' },
                { rule: 'Margin-first: Minimum $8/hr margin floor on all submissions', icon: CurrencyDollarIcon, color: 'text-blue-600' },
                { rule: 'Premium-skill-first: AI/ML + MLOps + DataEng get 8-15pt bonus', icon: SparklesIcon, color: 'text-purple-600' },
                { rule: 'Supply-fit-first: Best closable openings, not most openings', icon: UserGroupIcon, color: 'text-amber-600' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                  <item.icon className={`mt-0.5 h-5 w-5 shrink-0 ${item.color}`} />
                  <p className="text-sm text-gray-700">{item.rule}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LANES TAB */}
      {activeTab === 'lanes' && lanePerf && (
        <div className="space-y-6">
          {/* Lane cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(lanePerf.lanes || []).map((lane: any) => {
              const strategy = lanePerf.strategies?.[lane.lane];
              return (
                <div key={lane.lane} className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <LaneBadge lane={lane.lane} />
                    <span className="text-xs text-gray-400">{lane.totalQueued} total</span>
                  </div>
                  {strategy && (
                    <p className="mb-3 text-xs text-gray-500">{strategy.focus}</p>
                  )}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{lane.totalSent || 0}</p>
                      <p className="text-xs text-gray-500">Sent</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{lane.avgMatchScore || 0}</p>
                      <p className="text-xs text-gray-500">Avg Match</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{lane.avgPriority || 0}</p>
                      <p className="text-xs text-gray-500">Avg Priority</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Premium Bonus</span>
                      <span className="font-medium text-gray-700">{lane.avgPremiumBonus || 0}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Supply Fit</span>
                      <span className="font-medium text-gray-700">{lane.avgSupplyFit || 0}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Vendor Trust</span>
                      <span className="font-medium text-gray-700">{lane.avgVendorTrust || 0}</span>
                    </div>
                  </div>
                  {strategy?.rules && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <p className="mb-1.5 text-xs font-medium text-gray-600">Rules</p>
                      <ul className="space-y-1">
                        {strategy.rules.map((r: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                            <CheckCircleIcon className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Vendor Tier Distribution */}
          {(lanePerf.vendorTiers || []).length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-base font-semibold text-gray-900">Vendor Tier Distribution</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="pb-3 pr-4">Tier</th>
                      <th className="pb-3 pr-4">Count</th>
                      <th className="pb-3 pr-4">Avg Trust</th>
                      <th className="pb-3 pr-4">Avg Placements</th>
                      <th className="pb-3 pr-4">Response Rate</th>
                      <th className="pb-3">Interview Grant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lanePerf.vendorTiers.map((vt: any) => (
                      <tr key={vt.tier} className="text-gray-700 cursor-pointer hover:bg-indigo-50 transition-colors" onClick={() => setSelectedRow(vt)}>
                        <td className="py-2.5 pr-4"><TierBadge tier={vt.tier} /></td>
                        <td className="py-2.5 pr-4 font-medium">{vt.count}</td>
                        <td className="py-2.5 pr-4"><ScoreBadge score={vt.avgTrust} /></td>
                        <td className="py-2.5 pr-4">{vt.avgPlacements || '—'}</td>
                        <td className="py-2.5 pr-4">{vt.avgResponseRate ? `${vt.avgResponseRate}%` : '—'}</td>
                        <td className="py-2.5">{vt.avgInterviewGrant ? `${vt.avgInterviewGrant}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TECH TIERS TAB */}
      {activeTab === 'tech' && (
        <div className="space-y-6">
          {techTiers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <SparklesIcon className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-700">No Technology Tiers Configured</h3>
              <p className="mt-1 text-sm text-gray-500">
                Seed the tech tier configuration to enable profitability-ranked technology portfolio management.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="w-8 px-2 py-3" />
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Technology Family</th>
                    <th className="px-4 py-3">C2C Rate Range</th>
                    <th className="px-4 py-3">Competition</th>
                    <th className="px-4 py-3">Portfolio %</th>
                    <th className="px-4 py-3">Live Reqs (30d)</th>
                    <th className="px-4 py-3">Week Reqs</th>
                    <th className="px-4 py-3">Avg Actionability</th>
                    <th className="w-8 px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {techTiers.map((t: any) => {
                    const isExpanded = expandedFamily === (t.premiumSkillFamily || 'OTHER');
                    const hasReqs = (t.liveMetrics?.totalReqs ?? 0) > 0;
                    return (
                      <React.Fragment key={t.id}>
                        <tr
                          className={`transition-colors ${hasReqs ? 'cursor-pointer hover:bg-indigo-50/50' : 'hover:bg-gray-50/50'} ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                          onClick={() => hasReqs && handleTierClick(t.premiumSkillFamily)}
                        >
                          <td className="px-2 py-3 text-center">
                            {hasReqs && (
                              isExpanded
                                ? <ChevronDownIcon className="mx-auto h-4 w-4 text-indigo-500" />
                                : <ChevronRightIcon className="mx-auto h-4 w-4 text-gray-400" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{t.rank}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{t.technologyFamily}</p>
                            {t.premiumSkillFamily && <p className="text-xs text-gray-400">{t.premiumSkillFamily}</p>}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {t.c2cBillRateMin && t.c2cBillRateMax
                              ? `$${t.c2cBillRateMin}-$${t.c2cBillRateMax}/hr`
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {t.competitionLevel ? (
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                t.competitionLevel === 'LOW' ? 'bg-green-100 text-green-800' :
                                t.competitionLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>{t.competitionLevel}</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {t.portfolioAllocationPct != null ? (
                              <div className="w-20">
                                <p className="text-xs font-medium text-gray-700">{t.portfolioAllocationPct}%</p>
                                <ProgressBar value={t.portfolioAllocationPct} max={30} color="bg-indigo-500" />
                              </div>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {hasReqs ? (
                              <span className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2">{t.liveMetrics.totalReqs}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{t.liveMetrics?.weekReqs ?? 0}</td>
                          <td className="px-4 py-3"><ScoreBadge score={t.liveMetrics?.avgActionability} /></td>
                          <td className="px-2 py-3 text-center">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedRow(t); }} className="rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" title="View Details"><EyeIcon className="h-3.5 w-3.5" /></button>
                          </td>
                        </tr>

                        {/* EXPANDED: Req signals for this family */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={10} className="bg-gray-50/70 px-4 py-0">
                              <div className="py-4">
                                {/* ── Filter Bar ── */}
                                <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex flex-wrap items-end gap-2">
                                    <div className="min-w-[160px] flex-1">
                                      <label className="mb-1 block text-xs font-medium text-gray-500">Search Job Title / Company</label>
                                      <div className="relative">
                                        <MagnifyingGlassIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                                        <input
                                          type="text"
                                          value={filterSearch}
                                          onChange={(e) => setFilterSearch(e.target.value)}
                                          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                          placeholder="e.g. ML Engineer, Azure..."
                                          className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-xs focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        />
                                      </div>
                                    </div>
                                    <div className="min-w-[140px]">
                                      <label className="mb-1 block text-xs font-medium text-gray-500">Location</label>
                                      <select
                                        value={filterLocation}
                                        onChange={(e) => setFilterLocation(e.target.value)}
                                        className="w-full rounded-md border border-gray-200 py-1.5 pl-2 pr-6 text-xs focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                      >
                                        <option value="">All Locations</option>
                                        {filterLocations.slice(0, 100).map((loc) => (
                                          <option key={loc} value={loc}>{loc.length > 40 ? loc.slice(0, 40) + '...' : loc}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="min-w-[110px]">
                                      <label className="mb-1 block text-xs font-medium text-gray-500">Contract Type</label>
                                      <select
                                        value={filterEngModel}
                                        onChange={(e) => setFilterEngModel(e.target.value)}
                                        className="w-full rounded-md border border-gray-200 py-1.5 pl-2 pr-6 text-xs focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                      >
                                        <option value="ALL">All Types</option>
                                        {filterEngModels.map((em) => (
                                          <option key={em.model} value={em.model}>{em.model} ({em.count})</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="min-w-[80px]">
                                      <label className="mb-1 block text-xs font-medium text-gray-500">Min Rate</label>
                                      <input
                                        type="number"
                                        value={filterMinRate}
                                        onChange={(e) => setFilterMinRate(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                        placeholder="$0"
                                        className="w-full rounded-md border border-gray-200 py-1.5 px-2 text-xs focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                      />
                                    </div>
                                    <div className="min-w-[80px]">
                                      <label className="mb-1 block text-xs font-medium text-gray-500">Max Rate</label>
                                      <input
                                        type="number"
                                        value={filterMaxRate}
                                        onChange={(e) => setFilterMaxRate(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                        placeholder="$999"
                                        className="w-full rounded-md border border-gray-200 py-1.5 px-2 text-xs focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                      />
                                    </div>
                                    <button
                                      onClick={applyFilters}
                                      className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                                    >
                                      <FunnelIcon className="h-3.5 w-3.5" />
                                      Filter
                                    </button>
                                    {(filterLocation || filterEngModel !== 'ALL' || filterSearch || filterMinRate || filterMaxRate) && (
                                      <button
                                        onClick={() => {
                                          setFilterLocation('');
                                          setFilterEngModel('ALL');
                                          setFilterSearch('');
                                          setFilterMinRate('');
                                          setFilterMaxRate('');
                                          loadFamilyReqs(expandedFamily, 1);
                                        }}
                                        className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {familyReqsLoading ? (
                                  <div className="flex items-center justify-center py-6">
                                    <ArrowPathIcon className="h-5 w-5 animate-spin text-indigo-400" />
                                    <span className="ml-2 text-sm text-gray-500">Loading requirements...</span>
                                  </div>
                                ) : familyReqs.length === 0 ? (
                                  <p className="py-4 text-center text-sm text-gray-400">No requirement signals found{(filterSearch || filterLocation || filterEngModel !== 'ALL') ? ' for these filters' : ' for this family'}.</p>
                                ) : (
                                  <>
                                    <div className="mb-3 flex items-center justify-between">
                                      <p className="text-xs font-medium text-gray-500">
                                        Showing {familyReqs.length} of {familyReqsPagination?.total?.toLocaleString()} requirements
                                        {familyReqsPagination?.totalPages > 1 && ` (page ${familyReqsPage} of ${familyReqsPagination.totalPages})`}
                                      </p>
                                      {familyReqsPagination?.totalPages > 1 && (
                                        <div className="flex gap-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              loadFamilyReqs(expandedFamily, familyReqsPage - 1, {
                                                location: filterLocation, engagementModel: filterEngModel,
                                                search: filterSearch, minRate: filterMinRate, maxRate: filterMaxRate,
                                              });
                                            }}
                                            disabled={familyReqsPage <= 1}
                                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                                          >
                                            Prev
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              loadFamilyReqs(expandedFamily, familyReqsPage + 1, {
                                                location: filterLocation, engagementModel: filterEngModel,
                                                search: filterSearch, minRate: filterMinRate, maxRate: filterMaxRate,
                                              });
                                            }}
                                            disabled={familyReqsPage >= familyReqsPagination.totalPages}
                                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                                          >
                                            Next
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      {familyReqs.map((req: any) => (
                                        <div
                                          key={req.id}
                                          className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 transition-all hover:border-indigo-300 hover:shadow-md"
                                          onClick={(e) => { e.stopPropagation(); openReqDetail(req); }}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                              <p className="truncate font-medium text-indigo-700 underline decoration-indigo-200 underline-offset-2">{req.title}</p>
                                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                                {req.vendorName && (
                                                  <span className="flex items-center gap-1">
                                                    <BuildingOfficeIcon className="h-3 w-3" />
                                                    {req.vendorName}
                                                  </span>
                                                )}
                                                {req.location && (
                                                  <span className="flex items-center gap-1">
                                                    <MapPinIcon className="h-3 w-3" />
                                                    {req.location}
                                                  </span>
                                                )}
                                                {req.rateText && (
                                                  <span className="flex items-center gap-1">
                                                    <CurrencyDollarIcon className="h-3 w-3" />
                                                    {req.rateText}
                                                  </span>
                                                )}
                                                {req.contactEmail && (
                                                  <a
                                                    href={req.contactEmail.startsWith('http') ? req.contactEmail : `mailto:${req.contactEmail}`}
                                                    target={req.contactEmail.startsWith('http') ? '_blank' : undefined}
                                                    rel={req.contactEmail.startsWith('http') ? 'noopener noreferrer' : undefined}
                                                    className="flex items-center gap-1 text-indigo-600 hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <EnvelopeIcon className="h-3 w-3" />
                                                    {req.contactEmail.startsWith('http') ? 'View Posting' : req.contactEmail}
                                                  </a>
                                                )}
                                                {req.createdAt && (
                                                  <span className="flex items-center gap-1">
                                                    <ClockIcon className="h-3 w-3" />
                                                    {new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                  </span>
                                                )}
                                              </div>
                                              {req.skills && req.skills.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                  {(req.skills as string[]).slice(0, 8).map((sk: string, i: number) => (
                                                    <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{sk}</span>
                                                  ))}
                                                  {req.skills.length > 8 && <span className="text-xs text-gray-400">+{req.skills.length - 8} more</span>}
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1">
                                              <ScoreBadge score={req.actionabilityScore} label={`${req.actionabilityScore || 0} act`} />
                                              {req.engagementModel && req.engagementModel !== 'UNKNOWN' && (
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                  req.engagementModel === 'C2C' ? 'bg-emerald-100 text-emerald-700' :
                                                  req.engagementModel === 'W2' ? 'bg-blue-100 text-blue-700' :
                                                  req.engagementModel === 'FTE' ? 'bg-purple-100 text-purple-700' :
                                                  'bg-gray-100 text-gray-600'
                                                }`}>{req.engagementModel}</span>
                                              )}
                                              {req.premiumSkillBonus > 0 && (
                                                <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">+{req.premiumSkillBonus} bonus</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUPPLY-DEMAND TAB */}
      {activeTab === 'supply' && supplyDemand && (
        <div className="space-y-6">
          {/* Demand side */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              <SignalIcon className="mr-2 inline h-5 w-5 text-indigo-500" />
              Demand (Req Signals by Premium Family — Last 30 Days)
            </h3>
            {(supplyDemand.demand || []).length === 0 ? (
              <p className="text-sm text-gray-400">No demand data available</p>
            ) : (
              <div className="space-y-3">
                {supplyDemand.demand.map((d: any) => (
                  <div key={d.family} className="flex items-center gap-4 cursor-pointer hover:bg-indigo-50 rounded-lg px-2 py-1 -mx-2 transition-colors" onClick={() => setSelectedRow(d)}>
                    <span className="w-36 shrink-0 text-sm font-medium text-gray-700">{d.family || 'OTHER'}</span>
                    <div className="flex-1">
                      <ProgressBar value={d.recentReqs || 0} max={Math.max(...supplyDemand.demand.map((x: any) => x.recentReqs || 1))} color="bg-blue-500" />
                    </div>
                    <div className="flex w-48 justify-between text-xs text-gray-500">
                      <span>{d.recentReqs} recent</span>
                      <span>{d.highActionReqs} high-action</span>
                      <ScoreBadge score={d.avgActionability} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supply side */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              <UserGroupIcon className="mr-2 inline h-5 w-5 text-emerald-500" />
              Supply (Consultants by Premium Skill Family)
            </h3>
            {(supplyDemand.supply || []).length === 0 ? (
              <p className="text-sm text-gray-400">No supply data available</p>
            ) : (
              <div className="space-y-3">
                {supplyDemand.supply.map((s: any) => (
                  <div key={s.family} className="flex items-center gap-4 cursor-pointer hover:bg-indigo-50 rounded-lg px-2 py-1 -mx-2 transition-colors" onClick={() => setSelectedRow(s)}>
                    <span className="w-36 shrink-0 text-sm font-medium text-gray-700">{s.family || 'UNASSIGNED'}</span>
                    <div className="flex-1">
                      <ProgressBar value={s.readyConsultants || 0} max={Math.max(...supplyDemand.supply.map((x: any) => x.readyConsultants || 1), 1)} color="bg-emerald-500" />
                    </div>
                    <div className="flex w-56 justify-between text-xs text-gray-500">
                      <span>{s.readyConsultants} ready</span>
                      <span>{s.highQualityConsultants} high-quality</span>
                      <span>{s.totalConsultants} total</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lane performance from queue */}
          {(supplyDemand.lanePerformance || []).length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-base font-semibold text-gray-900">
                <AdjustmentsHorizontalIcon className="mr-2 inline h-5 w-5 text-purple-500" />
                Lane Queue Performance (30 Days)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="pb-3 pr-4">Lane</th>
                      <th className="pb-3 pr-4">Queued</th>
                      <th className="pb-3 pr-4">Sent</th>
                      <th className="pb-3 pr-4">Avg Match</th>
                      <th className="pb-3">Avg Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {supplyDemand.lanePerformance.map((lp: any) => (
                      <tr key={lp.lane} className="text-gray-700 cursor-pointer hover:bg-indigo-50 transition-colors" onClick={() => setSelectedRow(lp)}>
                        <td className="py-2.5 pr-4"><LaneBadge lane={lp.lane} /></td>
                        <td className="py-2.5 pr-4 font-medium">{lp.queuedItems}</td>
                        <td className="py-2.5 pr-4">{lp.sentItems}</td>
                        <td className="py-2.5 pr-4"><ScoreBadge score={lp.avgMatch} /></td>
                        <td className="py-2.5"><ScoreBadge score={lp.avgPriority} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedRow && (
        <StaticDrillDownModal
          title={selectedRow.technologyFamily || selectedRow.tier || selectedRow.family || selectedRow.lane || 'Details'}
          rows={[selectedRow]}
          onClose={() => setSelectedRow(null)}
        />
      )}

      {/* ═══ REQ DETAIL + APPLY MODAL ═══ */}
      <Modal
        open={!!selectedReq}
        onClose={() => { setSelectedReq(null); setMatchData(null); setSubmitResult(null); }}
        title="Requirement Details"
        size="xl"
      >
        {selectedReq && (
          <div className="space-y-5">
            {/* Req header */}
            <div>
              <h2 className="text-lg font-bold text-gray-900">{selectedReq.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                {selectedReq.vendorName && (
                  <span className="flex items-center gap-1">
                    <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-700">{selectedReq.vendorName}</span>
                    {selectedReq.vendorDomain && (
                      <a href={`https://${selectedReq.vendorDomain}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-500 hover:underline">({selectedReq.vendorDomain})</a>
                    )}
                  </span>
                )}
                {selectedReq.location && (
                  <span className="flex items-center gap-1">
                    <MapPinIcon className="h-4 w-4 text-gray-400" />
                    {selectedReq.location}
                  </span>
                )}
                {selectedReq.rateText && (
                  <span className="flex items-center gap-1 font-semibold text-green-600">
                    <CurrencyDollarIcon className="h-4 w-4" />
                    {selectedReq.rateText}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {selectedReq.contactName && <span>Contact: <strong>{selectedReq.contactName}</strong></span>}
                {selectedReq.contactEmail && (
                  <a
                    href={selectedReq.contactEmail.startsWith('http') ? selectedReq.contactEmail : `mailto:${selectedReq.contactEmail}`}
                    target={selectedReq.contactEmail.startsWith('http') ? '_blank' : undefined}
                    rel={selectedReq.contactEmail.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="text-indigo-600 underline"
                  >
                    {selectedReq.contactEmail.startsWith('http') ? 'View Job Posting' : selectedReq.contactEmail}
                  </a>
                )}
                {selectedReq.engagementModel && selectedReq.engagementModel !== 'UNKNOWN' && (
                  <span className={`rounded-full px-2 py-0.5 font-medium ${
                    selectedReq.engagementModel === 'C2C' ? 'bg-emerald-100 text-emerald-700' :
                    selectedReq.engagementModel === 'W2' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{selectedReq.engagementModel}</span>
                )}
                {selectedReq.actionabilityScore && <ScoreBadge score={selectedReq.actionabilityScore} label={`Actionability: ${selectedReq.actionabilityScore}`} />}
                {selectedReq.premiumSkillBonus > 0 && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700">+{selectedReq.premiumSkillBonus} premium</span>
                )}
              </div>
              {selectedReq.skills?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(selectedReq.skills as string[]).map((sk: string, i: number) => (
                    <span key={i} className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{sk}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Submit result banner */}
            {submitResult && (
              <div className={`rounded-lg border p-3 text-sm ${submitResult.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                {submitResult.success ? <CheckCircleIcon className="mr-1 inline h-4 w-4" /> : <ExclamationTriangleIcon className="mr-1 inline h-4 w-4" />}
                {submitResult.message}
              </div>
            )}

            {/* Matching consultants */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <SparklesIcon className="h-5 w-5 text-indigo-500" />
                AI-Matched Consultants
                {matchData?.topMatches && <span className="text-gray-400">({matchData.topMatches.length})</span>}
              </h3>

              {matchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <ArrowPathIcon className="h-6 w-6 animate-spin text-indigo-400" />
                  <span className="ml-2 text-sm text-gray-500">Finding matching consultants...</span>
                </div>
              ) : matchData?.topMatches?.length > 0 ? (
                <div className="space-y-2">
                  {matchData.topMatches.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${
                          c.matchScore >= 70 ? 'bg-green-500' : c.matchScore >= 40 ? 'bg-amber-500' : 'bg-gray-400'
                        }`}>{c.matchScore}</div>
                        <div>
                          <p className="font-medium text-gray-900">{c.fullName}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {c.email && <span className="text-indigo-600">{c.email}</span>}
                            {c.phone && <span>{c.phone}</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.matchingSkills?.map((s: string) => (
                              <span key={s} className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">{s}</span>
                            ))}
                            {c.partialSkills?.map((s: string) => (
                              <span key={s} className="rounded bg-yellow-50 px-1.5 py-0.5 text-xs text-yellow-700">{s}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSubmitConsultant(c.id, c.fullName)}
                        disabled={submitting === c.id || submitResult?.success === true}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {submitting === c.id ? (
                          <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <PaperAirplaneIcon className="h-3.5 w-3.5" />
                        )}
                        {submitting === c.id ? 'Submitting...' : 'Apply'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center">
                  <UserIcon className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-400">No matching consultants found for this requirement.</p>
                  <p className="mt-1 text-xs text-gray-400">Add consultants with matching skills to enable submissions.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
