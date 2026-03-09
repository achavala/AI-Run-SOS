'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
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
} from '@heroicons/react/24/outline';

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
    } catch (err) {
      console.error('Strategy ops fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
          <div className="flex items-center gap-2">
            <button
              onClick={handleComputeQuality}
              disabled={computingQuality}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <BoltIcon className="h-4 w-4" />
              {computingQuality ? 'Computing...' : 'Compute Quality Scores'}
            </button>
            <button onClick={fetchData} className="btn-primary flex items-center gap-2 text-sm">
              <ArrowPathIcon className="h-4 w-4" />
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
            <KpiCard title="Total Req Signals" value={overview.pipeline?.totalSignals?.toLocaleString() || '0'} subtitle="from email extraction" icon={SignalIcon} />
            <KpiCard title="Premium Signals" value={`${overview.pipeline?.premiumSignals?.toLocaleString() || '0'} (${overview.pipeline?.premiumPct}%)`} subtitle="AI/ML, MLOps, Data Eng" icon={SparklesIcon} />
            <KpiCard title="Prime Vendors" value={`${overview.vendors?.prime || 0} / ${overview.vendors?.total || 0}`} subtitle="PRIME + DIRECT tier" icon={BuildingOfficeIcon} />
            <KpiCard title="Ready Consultants" value={`${overview.supply?.ready || 0} / ${overview.supply?.total || 0}`} subtitle="SUBMISSION_READY + VERIFIED" icon={UserGroupIcon} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KpiCard title="Submissions (30d)" value={String(overview.submissions?.last30d || 0)} subtitle={`${overview.submissions?.total || 0} lifetime`} icon={CurrencyDollarIcon} />
            <KpiCard
              title="Tech Tiers Configured"
              value={String(overview.configuration?.techTiers || 0)}
              subtitle={`${overview.configuration?.optEmployers || 0} OPT employers indexed`}
              icon={AcademicCapIcon}
            />
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
                      <tr key={vt.tier} className="text-gray-700">
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
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Technology Family</th>
                    <th className="px-4 py-3">C2C Rate Range</th>
                    <th className="px-4 py-3">Competition</th>
                    <th className="px-4 py-3">Portfolio %</th>
                    <th className="px-4 py-3">Live Reqs (30d)</th>
                    <th className="px-4 py-3">Week Reqs</th>
                    <th className="px-4 py-3">Avg Actionability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {techTiers.map((t: any) => (
                    <tr key={t.id} className="hover:bg-gray-50/50">
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
                      <td className="px-4 py-3 font-medium text-gray-900">{t.liveMetrics?.totalReqs ?? 0}</td>
                      <td className="px-4 py-3 text-gray-700">{t.liveMetrics?.weekReqs ?? 0}</td>
                      <td className="px-4 py-3"><ScoreBadge score={t.liveMetrics?.avgActionability} /></td>
                    </tr>
                  ))}
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
                  <div key={d.family} className="flex items-center gap-4">
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
                  <div key={s.family} className="flex items-center gap-4">
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
                      <tr key={lp.lane} className="text-gray-700">
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
    </div>
  );
}
