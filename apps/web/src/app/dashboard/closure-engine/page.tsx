'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  ArrowPathIcon,
  BoltIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CurrencyDollarIcon,
  FireIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  UserIcon,
  ClockIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${(Number(n) * 100).toFixed(0)}%`;
}

const TIER_STYLES: Record<string, string> = {
  HOT: 'bg-red-100 text-red-800 border-red-200',
  WARM: 'bg-orange-100 text-orange-800 border-orange-200',
  COOL: 'bg-blue-100 text-blue-800 border-blue-200',
  COLD: 'bg-gray-100 text-gray-600 border-gray-200',
  READY: 'bg-teal-100 text-teal-800 border-teal-200',
};

const EMP_STYLES: Record<string, string> = {
  C2C: 'bg-emerald-100 text-emerald-700',
  W2: 'bg-blue-100 text-blue-700',
  CONTRACT: 'bg-purple-100 text-purple-700',
  C2H: 'bg-amber-100 text-amber-700',
  FTE: 'bg-gray-100 text-gray-600',
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${TIER_STYLES[tier] || TIER_STYLES.COLD}`}>
      {tier === 'HOT' && <FireIcon className="h-3 w-3 mr-0.5" />}
      {tier}
    </span>
  );
}

function ScoreBar({ score, max = 100, label }: { score: number; max?: number; label: string }) {
  const p = Math.min((score / max) * 100, 100);
  const color = p >= 70 ? 'bg-red-500' : p >= 50 ? 'bg-orange-500' : p >= 30 ? 'bg-blue-500' : 'bg-gray-400';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-gray-500 text-right">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${p}%` }} />
      </div>
      <span className="w-8 font-mono text-right">{score.toFixed(0)}</span>
    </div>
  );
}

type Tab = 'closure' | 'workload' | 'feedback' | 'bench' | 'reputation' | 'rates' | 'model';

export default function ClosureEnginePage() {
  const [tab, setTab] = useState<Tab>('closure');
  const [closureData, setClosureData] = useState<any>(null);
  const [workloadData, setWorkloadData] = useState<any>(null);
  const [feedbackData, setFeedbackData] = useState<any>(null);
  const [benchData, setBenchData] = useState<any>(null);
  const [reputationData, setReputationData] = useState<any>(null);
  const [rateData, setRateData] = useState<any>(null);
  const [modelData, setModelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [showConsultantPicker, setShowConsultantPicker] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, w, f, b] = await Promise.all([
        api.get('/analytics/closure-ranked-queue?limit=30'),
        api.get('/analytics/recruiter-workload'),
        api.get('/analytics/vendor-feedback-loop'),
        api.get('/analytics/bench-readiness'),
      ]);
      setClosureData(c);
      setWorkloadData(w);
      setFeedbackData(f);
      setBenchData(b);
      // Load extra data without blocking
      Promise.all([
        api.get('/analytics/vendor-reputation').catch(() => null),
        api.get('/analytics/rate-intelligence').catch(() => null),
        api.get('/analytics/closure-model').catch(() => null),
        api.get('/consultants').catch(() => []),
      ]).then(([rep, rate, model, cons]) => {
        setReputationData(rep);
        setRateData(rate);
        setModelData(model);
        setConsultants(Array.isArray(cons) ? cons : (cons as any)?.data || []);
      });
    } catch (err) {
      console.error('Failed to load closure engine', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAutoAssign = async () => {
    setAssigning(true);
    try {
      const result = await api.post<{ assigned: number }>('/analytics/auto-assign-queue');
      alert(`Assigned ${result.assigned} reqs to recruiters`);
      load();
    } catch (err) {
      console.error('Auto-assign failed', err);
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const dist = closureData?.distribution || {};
  const tabs = [
    { id: 'closure' as const, label: 'Closure Queue', icon: FireIcon, count: dist.hot || 0 },
    { id: 'workload' as const, label: 'Workload', icon: UserGroupIcon, count: workloadData?.workload?.length || 0 },
    { id: 'feedback' as const, label: 'Vendor Feedback', icon: ArrowTrendingUpIcon, count: feedbackData?.vendors?.length || 0 },
    { id: 'bench' as const, label: 'Bench Readiness', icon: UserIcon, count: benchData?.summary?.total || 0 },
    { id: 'reputation' as const, label: 'Vendor Reputation', icon: ShieldCheckIcon, count: reputationData?.total || 0 },
    { id: 'rates' as const, label: 'Rate Intel', icon: CurrencyDollarIcon, count: rateData?.totalRateCards || 0 },
    { id: 'model' as const, label: 'Closure Model', icon: SparklesIcon, count: 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Closure Engine"
        description="Closure probability × margin ranked queue — institutional-level prioritization"
      />

      {/* Distribution Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-center">
          <FireIcon className="h-5 w-5 text-red-600 mx-auto" />
          <p className="text-2xl font-bold text-red-700 mt-1">{fmt(dist.hot)}</p>
          <p className="text-[10px] text-red-600 font-medium">HOT (70+)</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center">
          <BoltIcon className="h-5 w-5 text-orange-600 mx-auto" />
          <p className="text-2xl font-bold text-orange-700 mt-1">{fmt(dist.warm)}</p>
          <p className="text-[10px] text-orange-600 font-medium">WARM (50-69)</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
          <SparklesIcon className="h-5 w-5 text-blue-600 mx-auto" />
          <p className="text-2xl font-bold text-blue-700 mt-1">{fmt(dist.cool)}</p>
          <p className="text-[10px] text-blue-600 font-medium">COOL (30-49)</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-gray-400 mx-auto" />
          <p className="text-2xl font-bold text-gray-500 mt-1">{fmt(dist.cold)}</p>
          <p className="text-[10px] text-gray-500 font-medium">COLD (&lt;30)</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center">
          <ChartBarIcon className="h-5 w-5 text-indigo-600 mx-auto" />
          <p className="text-2xl font-bold text-indigo-700 mt-1">{dist.avgScore || '—'}</p>
          <p className="text-[10px] text-indigo-600 font-medium">AVG SCORE</p>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="h-4 w-4" />
            {t.label}
            <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
              tab === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-500'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ═══ TAB 1: CLOSURE-RANKED QUEUE ═══ */}
      {tab === 'closure' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
            <p className="text-sm text-red-800 font-medium">
              <RocketLaunchIcon className="h-4 w-4 inline mr-1" />
              Ranked by closure probability. HOT reqs have 70%+ chance of placement.
            </p>
            <button onClick={handleAutoAssign} disabled={assigning}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
              {assigning ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <PlayIcon className="h-3.5 w-3.5" />}
              Auto-Assign to Recruiters
            </button>
          </div>

          {closureData?.queue?.map((req: any, i: number) => (
            <div key={req.id}
              className={`rounded-xl border bg-white hover:shadow-md transition-shadow cursor-pointer ${
                selectedReq?.id === req.id ? 'ring-2 ring-red-500' : ''
              } ${req.closureTier === 'HOT' ? 'border-red-200' : ''}`}
              onClick={() => setSelectedReq(selectedReq?.id === req.id ? null : req)}>
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold shrink-0 ${
                    i < 5 ? 'bg-red-100 text-red-700' : i < 15 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TierBadge tier={req.closureTier} />
                      {req.employmentType && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${EMP_STYLES[req.employmentType] || EMP_STYLES.CONTRACT}`}>
                          {req.employmentType}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        req.closureScore >= 70 ? 'bg-red-100 text-red-800' : req.closureScore >= 50 ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        Score: {req.closureScore}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        P(close): {pct(req.closureProbability)}
                      </span>
                      {req.vendorTrust > 0 && (
                        <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                          <ShieldCheckIcon className="h-3 w-3" />Trust: {Math.round(req.vendorTrust)}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mt-1 truncate">{req.title || 'Untitled'}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {req.vendorName && <span className="flex items-center gap-1"><UserGroupIcon className="h-3 w-3" />{req.vendorName}</span>}
                      {req.location && <span className="flex items-center gap-1"><MapPinIcon className="h-3 w-3" />{req.location}</span>}
                      {req.rateText && <span className="flex items-center gap-1"><CurrencyDollarIcon className="h-3 w-3" />{req.rateText}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                      disabled={submitting === req.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowConsultantPicker(showConsultantPicker === req.id ? null : req.id);
                      }}>
                      {submitting === req.id
                        ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                        : <PaperAirplaneIcon className="h-3.5 w-3.5" />}
                      Submit
                    </button>
                    <ChevronRightIcon className={`h-4 w-4 text-gray-400 transition-transform ${selectedReq?.id === req.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              </div>

              {/* Consultant Picker for Quick Submit */}
              {showConsultantPicker === req.id && (
                <div className="mx-4 mb-2 mt-1 p-3 rounded-lg border border-indigo-200 bg-indigo-50" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-medium text-indigo-800 mb-2">Select consultant to submit:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {consultants.filter((c: any) => c.readiness !== 'ON_ASSIGNMENT' && c.readiness !== 'OFFBOARDED').map((c: any) => (
                      <button key={c.id}
                        className="text-left rounded-lg border bg-white p-2 hover:border-indigo-400 hover:bg-indigo-50 transition text-xs"
                        onClick={async () => {
                          setSubmitting(req.id);
                          setShowConsultantPicker(null);
                          try {
                            await api.post('/submissions/from-req-signal', {
                              reqSignalId: req.id,
                              consultantId: c.id,
                              notes: `Quick submit from Closure Engine (score: ${req.closureScore})`,
                            });
                            alert(`Submitted ${c.firstName} ${c.lastName} for: ${req.title}`);
                            load();
                          } catch (err: any) {
                            alert(`Submit failed: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
                          } finally {
                            setSubmitting(null);
                          }
                        }}>
                        <p className="font-medium">{c.firstName} {c.lastName}</p>
                        <p className="text-[10px] text-gray-500">{c.readiness}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedReq?.id === req.id && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-2">Score Breakdown</p>
                      <div className="space-y-1.5">
                        <ScoreBar score={req.breakdown.trust} max={25} label="Trust" />
                        <ScoreBar score={req.breakdown.rate} max={20} label="Rate" />
                        <ScoreBar score={req.breakdown.employment} max={15} label="Emp Type" />
                        <ScoreBar score={req.breakdown.completeness} max={10} label="Complete" />
                        <ScoreBar score={req.breakdown.vendorVolume} max={10} label="Volume" />
                        <ScoreBar score={req.breakdown.benchMatch} max={10} label="Bench" />
                        <ScoreBar score={req.breakdown.freshness} max={10} label="Fresh" />
                      </div>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div>
                        <p className="font-medium text-gray-700">Contact</p>
                        <p className="text-gray-500">{req.contactName || '—'}</p>
                        <p className="text-indigo-600">{req.contactEmail || 'no email'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Vendor</p>
                        <p className="text-gray-500">{req.vendorDomain || '—'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Skills</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(req.skills || []).slice(0, 8).map((s: string) => (
                            <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px]">{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ TAB 2: RECRUITER WORKLOAD ═══ */}
      {tab === 'workload' && workloadData && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center justify-between">
            <p className="text-sm text-blue-800 font-medium">
              <UserGroupIcon className="h-4 w-4 inline mr-1" />
              Max 30 reqs/recruiter/day. Auto-assignment distributes HOT reqs round-robin by capacity.
            </p>
            <button onClick={handleAutoAssign} disabled={assigning}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
              {assigning ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <PlayIcon className="h-3.5 w-3.5" />}
              Run Auto-Assign
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workloadData.workload?.map((r: any) => {
              const used = r.assignedToday;
              const cap = 30;
              const capPct = (used / cap) * 100;
              const barColor = capPct >= 90 ? 'bg-red-500' : capPct >= 60 ? 'bg-orange-500' : 'bg-green-500';

              return (
                <div key={r.recruiterEmail} className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-semibold capitalize">{r.name}</h3>
                      <p className="text-[10px] text-gray-400">{r.recruiterEmail}</p>
                    </div>
                    <span className={`text-xs font-bold rounded-full px-2 py-1 ${
                      r.remainingCapacity > 20 ? 'bg-green-100 text-green-700' :
                      r.remainingCapacity > 10 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {r.remainingCapacity} left
                    </span>
                  </div>

                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-3">
                    <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${capPct}%` }} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{r.assignedToday}</p>
                      <p className="text-gray-500">Assigned</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-600">{r.submittedToday}</p>
                      <p className="text-gray-500">Submitted</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-400">{r.skippedToday}</p>
                      <p className="text-gray-500">Skipped</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ TAB 3: VENDOR FEEDBACK LOOPS ═══ */}
      {tab === 'feedback' && feedbackData && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-white p-4 text-center">
              <p className="text-2xl font-bold text-indigo-700">{fmt(feedbackData.summary?.totalSubmissions90d)}</p>
              <p className="text-xs text-gray-500">Submissions (90d)</p>
            </div>
            <div className="rounded-xl border bg-white p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{fmt(feedbackData.summary?.totalReplies90d)}</p>
              <p className="text-xs text-gray-500">Replies (90d)</p>
            </div>
            <div className="rounded-xl border bg-white p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{fmt(feedbackData.summary?.interviewSignals90d)}</p>
              <p className="text-xs text-gray-500">Interview Signals</p>
            </div>
            <div className="rounded-xl border bg-white p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{fmt(feedbackData.summary?.offerSignals90d)}</p>
              <p className="text-xs text-gray-500">Offer Signals</p>
            </div>
          </div>

          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="text-sm font-semibold">Vendor Conversion Funnel (90 days)</h3>
              <p className="text-xs text-gray-500 mt-0.5">Tracks submission → reply → interview → offer per vendor domain</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500 bg-gray-50">
                    <th className="py-3 px-4">Vendor Domain</th>
                    <th className="py-3 px-4 text-right">Subs Sent</th>
                    <th className="py-3 px-4 text-right">Replies</th>
                    <th className="py-3 px-4 text-right">Interviews</th>
                    <th className="py-3 px-4 text-right">Rejections</th>
                    <th className="py-3 px-4 text-right">Offers</th>
                    <th className="py-3 px-4 text-right">Reply Rate</th>
                    <th className="py-3 px-4 text-right">Interview Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackData.vendors?.map((v: any) => (
                    <tr key={v.vendorDomain} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{v.vendorDomain}</td>
                      <td className="py-3 px-4 text-right">{fmt(v.submissionsSent)}</td>
                      <td className="py-3 px-4 text-right">{fmt(v.totalReplies)}</td>
                      <td className="py-3 px-4 text-right font-medium text-green-600">{fmt(v.interviewRequests)}</td>
                      <td className="py-3 px-4 text-right text-red-500">{fmt(v.rejections)}</td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600">{fmt(v.offers)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${Number(v.replyRate) >= 30 ? 'text-green-600' : Number(v.replyRate) >= 10 ? 'text-yellow-600' : 'text-gray-400'}`}>
                          {v.replyRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${Number(v.interviewRate) >= 20 ? 'text-green-600' : Number(v.interviewRate) >= 5 ? 'text-yellow-600' : 'text-gray-400'}`}>
                          {v.interviewRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 4: BENCH READINESS ═══ */}
      {tab === 'bench' && benchData && (
        <div className="space-y-4">
          {/* Tier Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{benchData.summary?.hot || 0}</p>
              <p className="text-[10px] text-red-600 font-medium">HOT</p>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center">
              <p className="text-2xl font-bold text-orange-700">{benchData.summary?.warm || 0}</p>
              <p className="text-[10px] text-orange-600 font-medium">WARM</p>
            </div>
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-center">
              <p className="text-2xl font-bold text-teal-700">{benchData.summary?.ready || 0}</p>
              <p className="text-[10px] text-teal-600 font-medium">READY</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-2xl font-bold text-gray-500">{benchData.summary?.cold || 0}</p>
              <p className="text-[10px] text-gray-500 font-medium">COLD</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center">
              <p className="text-2xl font-bold text-indigo-700">{benchData.summary?.total || 0}</p>
              <p className="text-[10px] text-indigo-600 font-medium">TOTAL</p>
            </div>
          </div>

          <div className="space-y-3">
            {benchData.consultants?.map((c: any) => (
              <div key={c.consultantId} className={`rounded-xl border bg-white p-5 shadow-sm ${
                c.tier === 'HOT' ? 'border-red-200' : c.tier === 'WARM' ? 'border-orange-200' : ''
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center h-10 w-10 rounded-full text-xs font-bold ${
                      c.tier === 'HOT' ? 'bg-red-100 text-red-700' :
                      c.tier === 'WARM' ? 'bg-orange-100 text-orange-700' :
                      c.tier === 'READY' ? 'bg-teal-100 text-teal-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {c.overallScore}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{c.name}</h4>
                      <p className="text-xs text-gray-500">{c.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TierBadge tier={c.tier} />
                    <span className={`text-[10px] rounded-full px-2 py-0.5 ${
                      c.readiness === 'SUBMISSION_READY' ? 'bg-green-100 text-green-700' :
                      c.readiness === 'VERIFIED' ? 'bg-blue-100 text-blue-700' :
                      c.readiness === 'ON_ASSIGNMENT' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {c.readiness}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <ScoreBar score={c.breakdown.skillsDemand} max={30} label="Skills" />
                    <ScoreBar score={c.breakdown.docCompleteness} max={20} label="Docs" />
                    <ScoreBar score={c.breakdown.availability} max={25} label="Avail" />
                    <ScoreBar score={c.breakdown.experience} max={15} label="Exp" />
                    <ScoreBar score={c.breakdown.workAuth} max={10} label="Auth" />
                  </div>
                  <div className="text-xs space-y-2">
                    <div>
                      <p className="font-medium text-gray-700">In-Demand Skills</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.matchingSkills?.length > 0 ? c.matchingSkills.map((s: string) => (
                          <span key={s} className="rounded bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[10px] font-medium">{s}</span>
                        )) : <span className="text-gray-400">No matches</span>}
                      </div>
                    </div>
                    {c.desiredRate && (
                      <div>
                        <p className="font-medium text-gray-700">Rate</p>
                        <p className="text-gray-500">${c.desiredRate}/hr desired {c.currentRate ? `(current: $${c.currentRate}/hr)` : ''}</p>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-700">Assignments</p>
                      <p className="text-gray-500">{c.activeAssignments} active</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Vendor Reputation Tab ═══ */}
      {tab === 'reputation' && reputationData && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {(reputationData.summary || []).map((s: any) => (
              <div key={s.status} className={`rounded-xl border p-4 text-center ${
                s.status === 'WHITELIST' ? 'border-green-200 bg-green-50' :
                s.status === 'BLACKLIST' ? 'border-red-200 bg-red-50' :
                'border-gray-200 bg-gray-50'
              }`}>
                <p className="text-2xl font-bold">{fmt(s.count)}</p>
                <p className="text-xs font-medium">{s.status}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-white p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Top Whitelisted Vendors</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-left py-2 px-2">Vendor</th>
                    <th className="text-right py-2 px-2">Reqs</th>
                    <th className="text-right py-2 px-2">Ghost Rate</th>
                    <th className="text-right py-2 px-2">Reply Rate</th>
                    <th className="text-center py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(reputationData.topWhitelist || []).map((v: any) => (
                    <tr key={v.vendorDomain} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <p className="font-medium text-gray-900">{v.vendorName}</p>
                        <p className="text-gray-400">{v.vendorDomain}</p>
                      </td>
                      <td className="text-right py-2 px-2 font-mono">{fmt(v.reqs)}</td>
                      <td className="text-right py-2 px-2 font-mono">{pct(v.ghostRate)}</td>
                      <td className="text-right py-2 px-2 font-mono text-green-600">{pct(v.replyRate)}</td>
                      <td className="text-center py-2 px-2">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">WHITELIST</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {(reputationData.topBlacklist || []).length > 0 && (
            <div className="rounded-xl border border-red-200 bg-white p-4">
              <h3 className="font-semibold text-red-700 mb-3">Blacklisted Vendors (High Ghost Rate)</h3>
              <div className="space-y-2">
                {(reputationData.topBlacklist || []).map((v: any) => (
                  <div key={v.vendorDomain} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-red-800">{v.vendorName}</p>
                      <p className="text-xs text-red-500">{v.vendorDomain}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-red-700">{pct(v.ghostRate)} ghost</p>
                      <p className="text-xs text-red-500">{fmt(v.reqs)} reqs</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Rate Intelligence Tab ═══ */}
      {tab === 'rates' && rateData && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center">
            <CurrencyDollarIcon className="h-6 w-6 text-indigo-600 mx-auto" />
            <p className="text-3xl font-bold text-indigo-700 mt-1">{fmt(rateData.totalRateCards)}</p>
            <p className="text-xs text-indigo-600">Rate cards across skill / location / employment type</p>
          </div>
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-500">
                    <th className="text-left py-2.5 px-3">Skill</th>
                    <th className="text-left py-2.5 px-3">Location</th>
                    <th className="text-left py-2.5 px-3">Type</th>
                    <th className="text-right py-2.5 px-3">Samples</th>
                    <th className="text-right py-2.5 px-3">Min</th>
                    <th className="text-right py-2.5 px-3">P25</th>
                    <th className="text-right py-2.5 px-3 font-bold">Median</th>
                    <th className="text-right py-2.5 px-3">P75</th>
                    <th className="text-right py-2.5 px-3">Max</th>
                    <th className="text-right py-2.5 px-3">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {(rateData.topRates || []).map((r: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-900">{r.skill}</td>
                      <td className="py-2 px-3 text-gray-500 truncate max-w-[120px]">{r.location}</td>
                      <td className="py-2 px-3"><span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        r.employment_type === 'C2C' ? 'bg-green-100 text-green-700' :
                        r.employment_type === 'W2' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{r.employment_type}</span></td>
                      <td className="py-2 px-3 text-right font-mono text-gray-500">{fmt(r.sample_count)}</td>
                      <td className="py-2 px-3 text-right font-mono text-gray-400">${r.rate_min}</td>
                      <td className="py-2 px-3 text-right font-mono text-gray-500">${r.rate_p25 || '—'}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">${r.rate_median}</td>
                      <td className="py-2 px-3 text-right font-mono text-gray-500">${r.rate_p75 || '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-gray-400">${r.rate_max}</td>
                      <td className="py-2 px-3 text-right font-mono text-indigo-600">${r.rate_avg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Closure Model Tab ═══ */}
      {tab === 'model' && modelData && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-4 ${
            modelData.modelType === 'data-driven' ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
          }`}>
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5" />
              <h3 className="font-semibold">
                Model Type: {modelData.modelType === 'data-driven' ? 'Data-Driven (Trained)' : 'Heuristic (Default)'}
              </h3>
            </div>
            {modelData.samples && (
              <p className="text-sm text-gray-600 mt-1">Trained on {fmt(modelData.samples)} submission outcomes</p>
            )}
            {modelData.reason && (
              <p className="text-sm text-yellow-700 mt-1">{modelData.reason}</p>
            )}
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Feature Weights</h3>
            <div className="space-y-3">
              {(modelData.weights || []).map((w: any) => (
                <div key={w.feature} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-32 shrink-0">{w.feature.replace(/_/g, ' ')}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${Math.max(w.weight * 100, 1)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-gray-700 w-12 text-right">{(w.weight * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {modelData.submissionStats && (
            <div className="rounded-xl border bg-white p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Submission Stats (Training Data)</h3>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xl font-bold">{fmt(modelData.submissionStats.total)}</p>
                  <p className="text-[10px] text-gray-500">Total</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xl font-bold text-blue-700">{fmt(modelData.submissionStats.interviews)}</p>
                  <p className="text-[10px] text-blue-500">Interviews</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <p className="text-xl font-bold text-green-700">{fmt(modelData.submissionStats.offers)}</p>
                  <p className="text-[10px] text-green-500">Offers</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="text-xl font-bold text-red-700">{fmt(modelData.submissionStats.rejections)}</p>
                  <p className="text-[10px] text-red-500">Rejections</p>
                </div>
              </div>
            </div>
          )}

          {modelData.recommendation && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              <strong>Next Step:</strong> {modelData.recommendation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
