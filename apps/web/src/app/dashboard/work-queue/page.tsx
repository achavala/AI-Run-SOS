'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  ArrowPathIcon,
  BoltIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FireIcon,
  PaperAirplaneIcon,
  PhoneArrowUpRightIcon,
  RocketLaunchIcon,
  SparklesIcon,
  UserGroupIcon,
  ChevronRightIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

function TierBadge({ tier }: { tier: string }) {
  const c: Record<string, string> = {
    PREMIUM: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    QUALITY: 'bg-blue-100 text-blue-800 border-blue-200',
    MODERATE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${c[tier] || 'bg-gray-100 text-gray-600'}`}>{tier}</span>;
}

function EmpBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const c: Record<string, string> = { C2C: 'bg-emerald-100 text-emerald-700', W2: 'bg-blue-100 text-blue-700', CONTRACT: 'bg-purple-100 text-purple-700', C2H: 'bg-amber-100 text-amber-700', FTE: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c[type] || 'bg-gray-100 text-gray-600'}`}>{type}</span>;
}

function ProgressBar({ current, target, label }: { current: number; target: number; label: string }) {
  const pct = Math.min((current / Math.max(target, 1)) * 100, 100);
  const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{current}/{target}</span>
      </div>
      <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type TabId = 'queue' | 'checklist' | 'efficiency';

export default function WorkQueuePage() {
  const [activeTab, setActiveTab] = useState<TabId>('queue');
  const [queue, setQueue] = useState<any>(null);
  const [efficiency, setEfficiency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, e]: any[] = await Promise.all([
        api.get('/analytics/actionable-queue'),
        api.get('/analytics/recruiter-efficiency'),
      ]);
      setQueue(q);
      setEfficiency(e);
    } catch (err) {
      console.error('Failed to load work queue', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" /></div>;
  }

  const tabs = [
    { id: 'queue' as const, label: 'Top 30 Queue', icon: FireIcon },
    { id: 'checklist' as const, label: 'Daily Checklist', icon: CheckCircleIcon },
    { id: 'efficiency' as const, label: 'Efficiency Table', icon: RocketLaunchIcon },
  ];

  const stats = queue?.stats || {};

  return (
    <div className="space-y-6">
      <PageHeader title="Work Queue" description="Enforced daily workflow — only work from this queue" />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-white p-4 text-center">
          <FireIcon className="h-6 w-6 text-emerald-600 mx-auto" />
          <p className="text-2xl font-bold text-emerald-700 mt-1">{fmt(stats.premium)}</p>
          <p className="text-xs text-gray-500">Premium (3d)</p>
        </div>
        <div className="rounded-xl border bg-white p-4 text-center">
          <SparklesIcon className="h-6 w-6 text-blue-600 mx-auto" />
          <p className="text-2xl font-bold text-blue-700 mt-1">{fmt(stats.quality)}</p>
          <p className="text-xs text-gray-500">Quality (3d)</p>
        </div>
        <div className="rounded-xl border bg-white p-4 text-center">
          <BoltIcon className="h-6 w-6 text-yellow-600 mx-auto" />
          <p className="text-2xl font-bold text-yellow-700 mt-1">{fmt(stats.moderate)}</p>
          <p className="text-xs text-gray-500">Moderate (3d)</p>
        </div>
        <div className="rounded-xl border bg-white p-4 text-center">
          <ExclamationTriangleIcon className="h-6 w-6 text-gray-400 mx-auto" />
          <p className="text-2xl font-bold text-gray-500 mt-1">{fmt(stats.lowValue)}</p>
          <p className="text-xs text-gray-500">Low Value (hidden)</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Tab 1: Top 30 Actionable Queue ═══ */}
      {activeTab === 'queue' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-sm text-indigo-800 font-medium">
              <RocketLaunchIcon className="h-4 w-4 inline mr-1" />
              These are your TOP 30 actionable reqs. Work ONLY from this list. Submit to all before moving to anything else.
            </p>
          </div>

          {queue?.queue?.map((req: any, i: number) => (
            <div key={req.id} className={`rounded-xl border bg-white p-4 hover:shadow-md transition-shadow cursor-pointer ${selectedReq?.id === req.id ? 'ring-2 ring-indigo-500' : ''}`}
              onClick={() => setSelectedReq(selectedReq?.id === req.id ? null : req)}>
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TierBadge tier={req.tier} />
                    <EmpBadge type={req.engagementModel || req.employmentType} />
                    {req.actionabilityScore && (
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        req.actionabilityScore >= 80 ? 'bg-green-100 text-green-800' : req.actionabilityScore >= 60 ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>Score: {req.actionabilityScore}</span>
                    )}
                    {req.vendorTrust && (
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <ShieldCheckIcon className="h-3 w-3" />Trust: {req.vendorTrust}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mt-1 truncate">{req.title || 'Untitled Req'}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {req.vendorName && <span className="flex items-center gap-1"><UserGroupIcon className="h-3 w-3" />{req.vendorName}</span>}
                    {req.location && <span className="flex items-center gap-1"><MapPinIcon className="h-3 w-3" />{req.location}</span>}
                    {req.rateText && <span className="flex items-center gap-1"><CurrencyDollarIcon className="h-3 w-3" />{req.rateText}</span>}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors flex items-center gap-1"
                    onClick={(e) => { e.stopPropagation(); /* TODO: wire to submission factory */ }}>
                    <PaperAirplaneIcon className="h-3.5 w-3.5" /> Submit
                  </button>
                  <ChevronRightIcon className={`h-4 w-4 text-gray-400 transition-transform ${selectedReq?.id === req.id ? 'rotate-90' : ''}`} />
                </div>
              </div>

              {/* Expanded detail */}
              {selectedReq?.id === req.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-medium text-gray-700">Contact</p>
                    <p className="text-gray-500">{req.contactName || '—'} ({req.contactEmail || 'no email'})</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Vendor Domain</p>
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
                  <div>
                    <p className="font-medium text-gray-700">Created</p>
                    <p className="text-gray-500">{req.createdAt ? new Date(req.createdAt).toLocaleString() : '—'}</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {(!queue?.queue || queue.queue.length === 0) && (
            <div className="rounded-xl border bg-gray-50 p-8 text-center">
              <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto" />
              <p className="text-lg font-medium text-gray-600 mt-3">Queue is empty</p>
              <p className="text-sm text-gray-500">No actionable reqs in the last 3 days. Run actionability scoring first.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Tab 2: Daily Checklist ═══ */}
      {activeTab === 'checklist' && efficiency && (
        <div className="space-y-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800 font-medium">
              <ClockIcon className="h-4 w-4 inline mr-1" />
              Complete all items before end of day. Progress resets at midnight.
            </p>
          </div>

          {/* Per-recruiter checklists */}
          {efficiency.allTime?.map((r: any) => {
            const todayData = efficiency.daily?.find((d: any) => d.email === r.email && new Date(d.day).toDateString() === new Date().toDateString()) || {};
            const todaySubs = todayData.verifiedSubmissions || 0;
            const todayReplies = todayData.externalRepliesSent || 0;
            const todayInterviews = todayData.interviewSignals || 0;

            const targetSubs = r.name === 'satya' ? 15 : r.name === 'sai.l' ? 10 : r.name === 'bharath' ? 10 : r.name === 'sameera' ? 10 : 5;
            const targetFollowups = 10;
            const targetInterviews = 2;

            return (
              <div key={r.email} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold capitalize">{r.name}</h3>
                    <p className="text-xs text-gray-500">{r.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">All-time: {fmt(r.totalVerifiedSubmissions)} subs / {fmt(r.totalInterviews)} interviews</p>
                    <p className="text-xs text-gray-500">Sub→Interview: {r.submissionToInterviewPct}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <ProgressBar current={todaySubs} target={targetSubs} label={`Submissions (target: ${targetSubs})`} />
                  <ProgressBar current={todayReplies} target={targetFollowups} label={`Follow-ups (target: ${targetFollowups})`} />
                  <ProgressBar current={todayInterviews} target={targetInterviews} label={`Interviews (target: ${targetInterviews})`} />
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-500">Today's reqs: <strong>{fmt(todayData.reqsReceived || 0)}</strong></span>
                    <span className="text-gray-500">Emails sent: <strong>{fmt(todayData.emailsSent || 0)}</strong></span>
                    <span className="text-gray-500">Vendor replies: <strong>{fmt(todayData.vendorReplies || 0)}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Tab 3: Recruiter Efficiency Table ═══ */}
      {activeTab === 'efficiency' && efficiency && (
        <div className="space-y-6">
          {/* All-time summary */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold mb-4">All-Time Recruiter Performance (Validated Metrics)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4">Recruiter</th>
                    <th className="pb-2 pr-4 text-right">Total Reqs</th>
                    <th className="pb-2 pr-4 text-right">Verified Subs</th>
                    <th className="pb-2 pr-4 text-right">Interviews</th>
                    <th className="pb-2 pr-4 text-right">Offers</th>
                    <th className="pb-2 pr-4 text-right">Vendor Replies</th>
                    <th className="pb-2 text-right">Sub→Interview %</th>
                  </tr>
                </thead>
                <tbody>
                  {efficiency.allTime?.map((r: any) => (
                    <tr key={r.email} className="border-b border-gray-50">
                      <td className="py-3 pr-4 font-medium capitalize">{r.name}</td>
                      <td className="py-3 pr-4 text-right">{fmt(r.totalReqs)}</td>
                      <td className="py-3 pr-4 text-right font-medium text-indigo-600">{fmt(r.totalVerifiedSubmissions)}</td>
                      <td className="py-3 pr-4 text-right">{fmt(r.totalInterviews)}</td>
                      <td className="py-3 pr-4 text-right">{fmt(r.totalOffers)}</td>
                      <td className="py-3 pr-4 text-right">{fmt(r.totalVendorReplies)}</td>
                      <td className="py-3 text-right">
                        <span className={`font-medium ${Number(r.submissionToInterviewPct) >= 10 ? 'text-green-600' : Number(r.submissionToInterviewPct) >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {r.submissionToInterviewPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily breakdown */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold mb-4">Daily Efficiency (Last 30 Days)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Recruiter</th>
                    <th className="pb-2 pr-4 text-right">Reqs</th>
                    <th className="pb-2 pr-4 text-right">Subs</th>
                    <th className="pb-2 pr-4 text-right">Replies</th>
                    <th className="pb-2 pr-4 text-right">Interviews</th>
                    <th className="pb-2 text-right">Emails Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {efficiency.daily?.slice(0, 60).map((d: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 pr-4 text-gray-500">{new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                      <td className="py-2 pr-4 capitalize font-medium">{d.name}</td>
                      <td className="py-2 pr-4 text-right">{fmt(d.reqsReceived)}</td>
                      <td className="py-2 pr-4 text-right font-medium text-indigo-600">{fmt(d.verifiedSubmissions)}</td>
                      <td className="py-2 pr-4 text-right">{fmt(d.vendorReplies)}</td>
                      <td className="py-2 pr-4 text-right">{fmt(d.interviewSignals)}</td>
                      <td className="py-2 text-right">{fmt(d.emailsSent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
