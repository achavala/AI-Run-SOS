'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  ArrowPathIcon,
  SparklesIcon,
  ChartBarIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  AcademicCapIcon,
  RocketLaunchIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  FireIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  ClockIcon,
  XMarkIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: 'bg-green-100 text-green-800 border-green-200',
    B: 'bg-blue-100 text-blue-800 border-blue-200',
    C: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    D: 'bg-red-100 text-red-800 border-red-200',
  };
  return (
    <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-sm font-bold ${colors[grade] || 'bg-gray-100 text-gray-600'}`}>
      {grade}
    </span>
  );
}

function DifficultyBadge({ d }: { d: string }) {
  const colors: Record<string, string> = {
    IMPOSSIBLE: 'bg-red-100 text-red-800',
    VERY_HARD: 'bg-orange-100 text-orange-800',
    HARD: 'bg-yellow-100 text-yellow-800',
    FILLABLE: 'bg-green-100 text-green-800',
    CRITICAL_SHORTAGE: 'bg-red-100 text-red-800',
    HIGH_DEMAND: 'bg-orange-100 text-orange-800',
    OVERSUPPLY: 'bg-blue-100 text-blue-800',
    BALANCED: 'bg-green-100 text-green-800',
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[d] || 'bg-gray-100 text-gray-600'}`}>{d}</span>;
}

/* ═══ Drill-Down Modal ═══ */

function DrillDownModal({ metric, onClose }: { metric: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailRecord, setDetailRecord] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/ai-agents/drilldown?metric=${encodeURIComponent(metric)}&limit=100`)
      .then((res: any) => setData(res))
      .catch((e: any) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [metric]);

  const renderCellValue = (val: any): string => {
    if (val == null) return '—';
    if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))) {
      return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (Array.isArray(val)) return val.slice(0, 5).join(', ') || '—';
    if (typeof val === 'object') {
      if (val.firstName) return `${val.firstName} ${val.lastName || ''}`.trim();
      if (val.companyName) return val.companyName;
      if (val.title) return val.title;
      if (val.consultant) return renderCellValue(val.consultant);
      if (val.job) return renderCellValue(val.job);
      if (val.vendor) return renderCellValue(val.vendor);
      return JSON.stringify(val).slice(0, 60);
    }
    return String(val);
  };

  const renderDetailValue = (val: any): React.ReactNode => {
    if (val == null) return <span className="text-gray-400">—</span>;
    if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))) {
      return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    if (Array.isArray(val)) {
      return val.length === 0
        ? <span className="text-gray-400">—</span>
        : <div className="flex flex-wrap gap-1">{val.map((v, i) => <span key={i} className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>)}</div>;
    }
    if (typeof val === 'object') {
      return <pre className="text-xs bg-gray-50 rounded p-2 whitespace-pre-wrap break-all">{JSON.stringify(val, null, 2)}</pre>;
    }
    return String(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-16 px-4" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{detailRecord ? 'Record Detail' : (data?.title || metric)}</h2>
            <p className="text-xs text-gray-500">{detailRecord ? 'All fields for this record' : (data?.description || '')}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[65vh] px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-indigo-500" />
              <span className="ml-2 text-sm text-gray-500">Loading records...</span>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-12">
              <ExclamationTriangleIcon className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="text-sm text-gray-600 mt-2">{error}</p>
            </div>
          )}

          {!loading && !error && data?.rows && detailRecord && (
            <div>
              <button
                onClick={() => setDetailRecord(null)}
                className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeftIcon className="h-4 w-4" /> Back to list
              </button>
              <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                {Object.entries(detailRecord).map(([key, val]) => (
                  <div key={key} className="flex gap-4 px-4 py-3">
                    <span className="text-xs font-medium text-gray-500 w-40 shrink-0 capitalize pt-0.5">
                      {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                    </span>
                    <div className="text-sm text-gray-800 min-w-0 flex-1">{renderDetailValue(val)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !error && data?.rows && !detailRecord && (
            <>
              <p className="text-xs text-gray-400 mb-3">{data.rows.length} records — click a row to see full details</p>
              {data.rows.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-12">No records found for this metric</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">#</th>
                      {Object.keys(data.rows[0]).filter(k => k !== 'id').map(key => (
                        <th key={key} className="px-3 py-2 text-left text-xs text-gray-500 font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row: any, idx: number) => (
                      <tr
                        key={row.id || idx}
                        onClick={() => setDetailRecord(row)}
                        className="border-b border-gray-50 hover:bg-indigo-50/50 transition-colors cursor-pointer"
                      >
                        <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                        {Object.entries(row).filter(([k]) => k !== 'id').map(([key, val]) => (
                          <td key={key} className="px-3 py-2 text-xs text-gray-700 max-w-[200px] truncate">
                            {key === 'status' ? (
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                val === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                                val === 'INTERVIEWING' ? 'bg-yellow-100 text-yellow-800' :
                                val === 'OFFERED' ? 'bg-green-100 text-green-800' :
                                val === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' :
                                val === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                val === 'SCHEDULED' ? 'bg-purple-100 text-purple-800' :
                                val === 'SUBMISSION_READY' ? 'bg-green-100 text-green-800' :
                                val === 'VERIFIED' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-600'
                              }`}>{String(val)}</span>
                            ) : key === 'trustScore' || key === 'score' || key === 'qualityScore' ? (
                              <span className={`font-medium ${Number(val) >= 60 ? 'text-green-600' : Number(val) >= 30 ? 'text-yellow-600' : 'text-gray-500'}`}>
                                {val != null ? Number(val).toFixed(0) : '—'}
                              </span>
                            ) : (
                              renderCellValue(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ Clickable Metric Card ═══ */

function MetricCard({ label, value, icon: Icon, color, metric }: {
  label: string; value: any; icon: any; color: string; metric: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="rounded-xl border bg-white p-4 text-center cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group"
      >
        <Icon className={`h-6 w-6 mx-auto ${color} group-hover:scale-110 transition-transform`} />
        <p className="text-2xl font-bold text-gray-900 mt-2 group-hover:text-indigo-700 transition-colors">
          {typeof value === 'number' ? fmt(value) : value}
        </p>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-[9px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1">Click to view details</p>
      </div>
      {open && <DrillDownModal metric={metric} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ═══ Clickable Target Tile ═══ */

function TargetTile({ label, value, bgClass, textClass, metric }: {
  label: string; value: string; bgClass: string; textClass: string; metric: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className={`rounded-lg ${bgClass} p-3 text-center cursor-pointer hover:shadow-md hover:ring-2 hover:ring-indigo-300 transition-all group`}
      >
        <p className={`text-xl font-bold ${textClass} group-hover:scale-105 transition-transform`}>{value}</p>
        <p className={`text-xs ${textClass} opacity-80 capitalize`}>{label}</p>
        <p className="text-[9px] text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">Click to drill down</p>
      </div>
      {open && <DrillDownModal metric={metric} onClose={() => setOpen(false)} />}
    </>
  );
}

type AgentId = 'sales' | 'recruiting' | 'jobSearch' | 'gm' | 'coach';

const DAILY_TARGET_METRICS: Record<string, string> = {
  submissions: 'submissions',
  replyFollowups: 'replyFollowups',
  newVendorOutreach: 'newVendorOutreach',
  benchCallsScheduled: 'benchCallsScheduled',
};

const WEEKLY_TARGET_METRICS: Record<string, string> = {
  interviews: 'interviews',
  offers: 'offers',
  closures: 'closures',
  newConsultantsOnboarded: 'newConsultantsOnboarded',
};

export default function AiAgentsPage() {
  const [activeAgent, setActiveAgent] = useState<AgentId>('gm');
  const [agentData, setAgentData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const agents: { id: AgentId; name: string; icon: any; endpoint: string; color: string }[] = [
    { id: 'gm', name: 'GM Strategist', icon: RocketLaunchIcon, endpoint: '/ai-agents/gm-strategist', color: 'indigo' },
    { id: 'sales', name: 'Sales Strategist', icon: CurrencyDollarIcon, endpoint: '/ai-agents/sales-strategist', color: 'emerald' },
    { id: 'recruiting', name: 'Recruiting Strategist', icon: UserGroupIcon, endpoint: '/ai-agents/recruiting-strategist', color: 'purple' },
    { id: 'jobSearch', name: 'Job Search Analyst', icon: MagnifyingGlassIcon, endpoint: '/ai-agents/job-search-analyst', color: 'blue' },
    { id: 'coach', name: 'Managerial Coach', icon: AcademicCapIcon, endpoint: '/ai-agents/managerial-coach', color: 'amber' },
  ];

  const loadAgent = useCallback(async (agentId: AgentId, force = false) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || (!force && agentData[agentId])) return;

    setLoading(prev => ({ ...prev, [agentId]: true }));
    setErrors(prev => { const n = { ...prev }; delete n[agentId]; return n; });
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      const res: any = await api.get(agent.endpoint, { signal: controller.signal });
      clearTimeout(timeout);
      setAgentData(prev => ({ ...prev, [agentId]: res }));
    } catch (e: any) {
      const msg = e?.name === 'AbortError'
        ? 'Request timed out. The analysis is running on a large dataset — please retry.'
        : (e?.message || 'Failed to load agent data');
      setErrors(prev => ({ ...prev, [agentId]: msg }));
      console.error(`Failed to load ${agentId}`, e);
    } finally {
      setLoading(prev => ({ ...prev, [agentId]: false }));
    }
  }, [agentData]);

  useEffect(() => { loadAgent(activeAgent); }, [activeAgent, loadAgent]);

  useEffect(() => {
    const ids: AgentId[] = ['gm', 'sales', 'recruiting', 'jobSearch', 'coach'];
    ids.forEach((id, i) => {
      setTimeout(() => loadAgent(id), (i + 1) * 2000);
    });
  }, []);

  const currentAgent = agents.find(a => a.id === activeAgent)!;
  const data = agentData[activeAgent];
  const isLoading = loading[activeAgent];
  const error = errors[activeAgent];

  return (
    <div className="space-y-6">
      <PageHeader title="AI Agents" description="5 specialized AI agents analyzing your staffing operation in real-time" />

      {/* Agent selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setActiveAgent(agent.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border ${
              activeAgent === agent.id
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <agent.icon className="h-5 w-5" />
            {agent.name}
            {agentData[agent.id] && <CheckCircleIcon className="h-4 w-4 text-green-500" />}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500 mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Agent analyzing data...</p>
            <p className="text-xs text-gray-400 mt-1">This may take a few seconds on first load</p>
          </div>
        </div>
      )}

      {!isLoading && error && (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center max-w-md">
            <ExclamationTriangleIcon className="h-10 w-10 text-amber-500 mx-auto" />
            <p className="text-sm text-gray-700 mt-3 font-medium">Agent analysis failed</p>
            <p className="text-xs text-gray-500 mt-1">{error}</p>
            <button
              onClick={() => loadAgent(activeAgent, true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <ArrowPathIcon className="h-4 w-4" /> Retry
            </button>
          </div>
        </div>
      )}

      {!isLoading && !error && data && (
        <div className="space-y-6">
          {/* Agent header */}
          <div className="rounded-xl border bg-gradient-to-r from-indigo-50 to-purple-50 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SparklesIcon className="h-6 w-6 text-indigo-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{data.agent || currentAgent.name}</h2>
                <p className="text-xs text-gray-500">Generated: {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'Now'}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setAgentData(prev => { const n = { ...prev }; delete n[activeAgent]; return n; });
                loadAgent(activeAgent, true);
              }}
              className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50"
            >
              <ArrowPathIcon className="h-4 w-4" /> Refresh
            </button>
          </div>

          {/* ═══ GM STRATEGIST ═══ */}
          {activeAgent === 'gm' && data.closurePlan && (
            <>
              {/* Current State — Clickable Metric Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <MetricCard
                  label="Quality Reqs" value={data.closurePlan?.currentState?.qualityReqsAvailable}
                  icon={FireIcon} color="text-orange-600" metric="qualityReqs"
                />
                <MetricCard
                  label="Bench Size" value={data.closurePlan?.currentState?.benchSize}
                  icon={UserGroupIcon} color="text-blue-600" metric="benchSize"
                />
                <MetricCard
                  label="Trusted Vendors" value={data.closurePlan?.currentState?.trustedVendorCount}
                  icon={ShieldCheckIcon} color="text-green-600" metric="trustedVendors"
                />
                <MetricCard
                  label="Subs Needed/Day" value={data.closurePlan?.dailyTargets?.submissions}
                  icon={BoltIcon} color="text-indigo-600" metric="subsNeeded"
                />
                <MetricCard
                  label="Pipeline"
                  value={`${data.closurePlan?.currentState?.currentPipeline?.submitted ?? 0}/${data.closurePlan?.currentState?.currentPipeline?.interviewing ?? 0}/${data.closurePlan?.currentState?.currentPipeline?.offered ?? 0}`}
                  icon={ChartBarIcon} color="text-purple-600" metric="pipeline"
                />
                <MetricCard
                  label="Close Prob" value={data.closurePlan?.currentState?.currentPipeline?.closureProbability}
                  icon={RocketLaunchIcon} color="text-emerald-600" metric="closeProbability"
                />
              </div>

              {/* Daily & Weekly Targets — Clickable Tiles */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-white p-5">
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2"><BoltIcon className="h-5 w-5 text-amber-500" /> Daily Targets</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(data.closurePlan?.dailyTargets || {}).map(([k, v]) => (
                      <TargetTile
                        key={k}
                        label={k.replace(/([A-Z])/g, ' $1')}
                        value={String(v)}
                        bgClass="bg-amber-50"
                        textClass="text-amber-700"
                        metric={DAILY_TARGET_METRICS[k] || k}
                      />
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border bg-white p-5">
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2"><ClockIcon className="h-5 w-5 text-blue-500" /> Weekly Targets</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(data.closurePlan?.weeklyTargets || {}).map(([k, v]) => (
                      <TargetTile
                        key={k}
                        label={k.replace(/([A-Z])/g, ' $1')}
                        value={String(v)}
                        bgClass="bg-blue-50"
                        textClass="text-blue-700"
                        metric={WEEKLY_TARGET_METRICS[k] || k}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Top Actions */}
              <div className="rounded-xl border bg-white p-5">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2"><RocketLaunchIcon className="h-5 w-5 text-indigo-500" /> Top Actions for 1 Closure/Day</h3>
                <ul className="space-y-2">
                  {data.closurePlan.topActions?.map((a: string, i: number) => (
                    <li key={i} className="flex gap-3 items-start text-sm">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0">{i + 1}</span>
                      <p className="text-gray-700">{a}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recruiter Scorecard */}
              <div className="rounded-xl border bg-white p-5">
                <h3 className="text-base font-semibold mb-3">Recruiter Scorecard</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="pb-2 pr-4">Recruiter</th>
                        <th className="pb-2 pr-4">Grade</th>
                        <th className="pb-2 pr-4 text-right">Reqs Received</th>
                        <th className="pb-2 pr-4 text-right">Submissions</th>
                        <th className="pb-2 pr-4 text-right">Interviews</th>
                        <th className="pb-2 text-right">Conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.closurePlan.recruiterScorecard?.map((r: any) => (
                        <tr key={r.name} className="border-b border-gray-50">
                          <td className="py-3 pr-4 font-medium capitalize">{r.name}</td>
                          <td className="py-3 pr-4"><GradeBadge grade={r.grade} /></td>
                          <td className="py-3 pr-4 text-right">{fmt(r.reqsReceived)}</td>
                          <td className="py-3 pr-4 text-right">{fmt(r.submissionsSent)}</td>
                          <td className="py-3 pr-4 text-right">{fmt(r.interviews)}</td>
                          <td className="py-3 text-right font-medium">{r.conversionRate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottlenecks */}
              {data.closurePlan.bottlenecks?.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                  <h3 className="text-base font-semibold text-red-800 mb-3 flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5" /> Bottlenecks
                  </h3>
                  <ul className="space-y-2">
                    {data.closurePlan.bottlenecks.map((b: string, i: number) => (
                      <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                        <span className="text-red-500 mt-1">•</span> {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* ═══ SALES STRATEGIST ═══ */}
          {activeAgent === 'sales' && data.data && (
            <>
              <div className="rounded-xl border bg-gradient-to-r from-emerald-50 to-green-50 p-5">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2"><SparklesIcon className="h-5 w-5 text-emerald-600" /> Strategic Insights</h3>
                <ul className="space-y-2">
                  {data.insights?.map((s: string, i: number) => (
                    <li key={i} className="flex gap-3 items-start text-sm text-gray-700">
                      <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <h3 className="text-base font-semibold mb-3">Technology Demand (Market)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {data.data.techDemand?.slice(0, 20).map((t: any) => (
                    <div key={t.technology} className="rounded-lg bg-gray-50 p-3 text-center">
                      <p className="text-sm font-medium text-gray-900">{t.technology}</p>
                      <p className="text-lg font-bold text-indigo-600">{fmt(t.demand)}</p>
                      <p className="text-[10px] text-gray-500">Last 7d: {fmt(t.demandLast7d)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <h3 className="text-base font-semibold mb-3">Bill Rate Distribution</h3>
                <div className="space-y-2">
                  {data.data.billRateAnalysis?.map((b: any) => {
                    const total = data.data.billRateAnalysis.reduce((s: number, x: any) => s + x.count, 0);
                    const pct = (b.count / Math.max(total, 1)) * 100;
                    return (
                      <div key={b.rateRange} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-28 shrink-0">{b.rateRange}</span>
                        <div className="flex-1 h-6 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-16 text-right">{fmt(b.count)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <h3 className="text-base font-semibold mb-3">Top Vendors by Req Volume</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="pb-2 pr-4">Vendor</th>
                        <th className="pb-2 pr-4 text-right">Total Reqs</th>
                        <th className="pb-2 pr-4 text-right">Last 30d</th>
                        <th className="pb-2 pr-4 text-right">Trust</th>
                        <th className="pb-2 text-right">Contacts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.topVendorsByVolume?.map((v: any) => (
                        <tr key={v.vendorName} className="border-b border-gray-50">
                          <td className="py-2 pr-4 font-medium">{v.vendorName}</td>
                          <td className="py-2 pr-4 text-right">{fmt(v.totalReqs)}</td>
                          <td className="py-2 pr-4 text-right">{fmt(v.reqs30d)}</td>
                          <td className="py-2 pr-4 text-right">
                            <span className={`font-medium ${v.trustScore >= 60 ? 'text-green-600' : v.trustScore >= 30 ? 'text-yellow-600' : 'text-gray-400'}`}>
                              {v.trustScore}
                            </span>
                          </td>
                          <td className="py-2 text-right">{fmt(v.contactCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2"><MapPinIcon className="h-5 w-5 text-blue-500" /> Location Hotspots</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {data.data.locationHotspots?.map((l: any) => (
                    <div key={l.location} className="rounded-lg bg-blue-50 px-3 py-2 flex justify-between items-center">
                      <span className="text-xs text-gray-700 truncate">{l.location}</span>
                      <span className="text-xs font-bold text-blue-700">{fmt(l.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ═══ RECRUITING STRATEGIST ═══ */}
          {activeAgent === 'recruiting' && data.data && (
            <>
              <div className="rounded-xl border bg-gradient-to-r from-purple-50 to-pink-50 p-5">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2"><SparklesIcon className="h-5 w-5 text-purple-600" /> Recruiting Insights</h3>
                <ul className="space-y-2">
                  {data.insights?.map((s: string, i: number) => (
                    <li key={i} className="flex gap-3 items-start text-sm text-gray-700">
                      <ArrowTrendingUpIcon className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>

              {data.data.talentPool?.[0] && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    { label: 'Total Consultants', value: data.data.talentPool[0].totalConsultants, metric: 'benchSize' },
                    { label: 'With Skills', value: data.data.talentPool[0].withSkills, metric: 'benchSize' },
                    { label: 'With Email', value: data.data.talentPool[0].withEmail, metric: 'benchSize' },
                    { label: 'With Phone', value: data.data.talentPool[0].withPhone, metric: 'benchSize' },
                    { label: 'Active 30d', value: data.data.talentPool[0].activeLast30d, metric: 'benchSize' },
                    { label: 'Active 7d', value: data.data.talentPool[0].activeLast7d, metric: 'benchSize' },
                  ].map((m) => (
                    <MetricCard key={m.label} label={m.label} value={m.value} icon={UserGroupIcon} color="text-purple-600" metric={m.metric} />
                  ))}
                </div>
              )}

              <div className="rounded-xl border bg-white p-5">
                <h3 className="text-base font-semibold mb-3">Skill Supply vs Demand Gap</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="pb-2 pr-4">Skill</th>
                        <th className="pb-2 pr-4 text-right">Demand</th>
                        <th className="pb-2 pr-4 text-right">Supply</th>
                        <th className="pb-2 pr-4 text-right">Gap</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.skillSupplyDemand?.slice(0, 25).map((g: any) => (
                        <tr key={g.skill} className="border-b border-gray-50">
                          <td className="py-2 pr-4 font-medium">{g.skill}</td>
                          <td className="py-2 pr-4 text-right">{fmt(g.demand)}</td>
                          <td className="py-2 pr-4 text-right">{fmt(g.supply)}</td>
                          <td className="py-2 pr-4 text-right font-medium">
                            <span className={g.gap > 0 ? 'text-red-600' : 'text-green-600'}>{g.gap > 0 ? `+${fmt(g.gap)}` : fmt(g.gap)}</span>
                          </td>
                          <td className="py-2"><DifficultyBadge d={g.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ═══ JOB SEARCH ANALYST ═══ */}
          {activeAgent === 'jobSearch' && data.data && (
            <>
              <div className="rounded-xl border bg-gradient-to-r from-blue-50 to-cyan-50 p-5">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2"><SparklesIcon className="h-5 w-5 text-blue-600" /> Job Market Insights</h3>
                <ul className="space-y-2">
                  {data.insights?.map((s: string, i: number) => (
                    <li key={i} className="flex gap-3 items-start text-sm text-gray-700">
                      <ArrowTrendingUpIcon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <h3 className="text-base font-semibold mb-3">Hard-to-Fill Roles (30 Days)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="pb-2 pr-4">Role</th>
                        <th className="pb-2 pr-4 text-right">Demand</th>
                        <th className="pb-2 pr-4 text-right">Supply</th>
                        <th className="pb-2 pr-4 text-right">Gap</th>
                        <th className="pb-2">Difficulty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.hardToFill?.map((h: any) => (
                        <tr key={h.role} className="border-b border-gray-50">
                          <td className="py-2 pr-4 font-medium">{h.role}</td>
                          <td className="py-2 pr-4 text-right">{fmt(h.demand)}</td>
                          <td className="py-2 pr-4 text-right">{fmt(h.supply)}</td>
                          <td className="py-2 pr-4 text-right font-medium text-red-600">+{fmt(h.gap)}</td>
                          <td className="py-2"><DifficultyBadge d={h.difficulty} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <h3 className="text-base font-semibold mb-3">Average Rate by Technology</h3>
                <div className="space-y-2">
                  {data.data.rateByTech?.map((r: any) => (
                    <div key={r.technology} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-32 truncate shrink-0">{r.technology}</span>
                      <div className="flex-1 h-5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min((Number(r.avgRate) / 120) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-16 text-right">${r.avgRate}/hr</span>
                      <span className="text-[10px] text-gray-400 w-12 text-right">{fmt(r.totalReqs)} reqs</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <h3 className="text-base font-semibold mb-3">Req Freshness Distribution</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {data.data.freshness?.map((f: any) => (
                    <div key={f.freshness} className="rounded-lg bg-gray-50 p-3 text-center">
                      <p className="text-lg font-bold text-gray-900">{fmt(f.count)}</p>
                      <p className="text-[10px] text-gray-500">{f.freshness.replace(/_/g, ' ')}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ═══ MANAGERIAL COACH ═══ */}
          {activeAgent === 'coach' && data.coaching && (
            <>
              <div className="rounded-xl border bg-gradient-to-r from-amber-50 to-orange-50 p-5">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2"><AcademicCapIcon className="h-5 w-5 text-amber-600" /> Team Improvement Actions</h3>
                <ul className="space-y-2">
                  {data.coaching.teamActions?.map((a: string, i: number) => (
                    <li key={i} className="flex gap-3 items-start text-sm text-gray-700">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold shrink-0">{i + 1}</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {data.coaching.individual?.map((r: any) => (
                  <div key={r.email} className="rounded-xl border bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold capitalize">{r.name}</h3>
                        <p className="text-xs text-gray-500">{r.email}</p>
                      </div>
                      <GradeBadge grade={r.grade} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                      <div className="rounded-lg bg-gray-50 p-2"><p className="text-lg font-bold">{fmt(r.metrics?.reqsReceived)}</p><p className="text-[10px] text-gray-500">Reqs</p></div>
                      <div className="rounded-lg bg-gray-50 p-2"><p className="text-lg font-bold">{fmt(r.metrics?.submissionsSent)}</p><p className="text-[10px] text-gray-500">Submissions</p></div>
                      <div className="rounded-lg bg-gray-50 p-2"><p className="text-lg font-bold">{fmt(r.metrics?.interviews)}</p><p className="text-[10px] text-gray-500">Interviews</p></div>
                    </div>

                    {r.strengths?.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-medium text-green-700 mb-1">Strengths</h4>
                        <ul className="space-y-1">
                          {r.strengths.map((s: string, i: number) => (
                            <li key={i} className="flex items-center gap-2 text-xs text-green-600"><CheckCircleIcon className="h-3.5 w-3.5" /> {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {r.improvements?.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-medium text-amber-700 mb-1">Areas for Improvement</h4>
                        <ul className="space-y-1">
                          {r.improvements.map((s: string, i: number) => (
                            <li key={i} className="flex items-center gap-2 text-xs text-amber-600"><ExclamationTriangleIcon className="h-3.5 w-3.5" /> {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {r.actions?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-indigo-700 mb-1">Action Items</h4>
                        <ul className="space-y-1">
                          {r.actions.map((a: string, i: number) => (
                            <li key={i} className="flex items-center gap-2 text-xs text-indigo-600"><ArrowTrendingUpIcon className="h-3.5 w-3.5" /> {a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
