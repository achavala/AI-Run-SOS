'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  ArrowPathIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  PhoneArrowUpRightIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n}%`;
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: 'bg-green-100 text-green-800',
    B: 'bg-blue-100 text-blue-800',
    C: 'bg-yellow-100 text-yellow-800',
    D: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${colors[grade] || 'bg-gray-100 text-gray-600'}`}>
      {grade}
    </span>
  );
}

function QualityTierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    PREMIUM: 'bg-emerald-100 text-emerald-800',
    QUALITY: 'bg-blue-100 text-blue-800',
    MODERATE: 'bg-yellow-100 text-yellow-800',
    LOW_VALUE: 'bg-orange-100 text-orange-800',
    JUNK: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[tier] || 'bg-gray-100 text-gray-600'}`}>
      {tier}
    </span>
  );
}

export default function RecruiterAnalyticsPage() {
  const [activity, setActivity] = useState<any>(null);
  const [pipeline, setPipeline] = useState<any>(null);
  const [quality, setQuality] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'activity' | 'pipeline' | 'quality'>('activity');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p, q]: any[] = await Promise.all([
        api.get('/analytics/recruiter-activity'),
        api.get('/analytics/email-pipeline'),
        api.get('/analytics/email-quality'),
      ]);
      setActivity(a);
      setPipeline(p);
      setQuality(q);
    } catch (e) {
      console.error('Failed to load analytics', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const tabs = [
    { id: 'activity' as const, label: 'Recruiter Activity', icon: EnvelopeIcon },
    { id: 'pipeline' as const, label: 'Email Pipeline', icon: FunnelIcon },
    { id: 'quality' as const, label: 'Email Quality (ML)', icon: ChartBarIcon },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Recruiter Analytics" description="Per-recruiter email activity, pipeline tracking, and ML quality scoring" />

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Tab 1: Recruiter Activity ═══ */}
      {activeTab === 'activity' && activity && (
        <div className="space-y-6">
          {/* Per-recruiter cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {activity.recruiters?.map((r: any) => (
              <div key={r.email} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">{r.name}</h3>
                    <p className="text-xs text-gray-500">{r.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-indigo-600">{fmt(r.totalEmails)}</p>
                    <p className="text-xs text-gray-500">total emails</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <PaperAirplaneIcon className="h-4 w-4 text-blue-500" />
                    <span className="text-gray-600">Sent:</span>
                    <span className="font-medium">{fmt(r.sent)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <EnvelopeIcon className="h-4 w-4 text-green-500" />
                    <span className="text-gray-600">Received:</span>
                    <span className="font-medium">{fmt(r.received)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="h-4 w-4 text-purple-500" />
                    <span className="text-gray-600">Replies Sent:</span>
                    <span className="font-medium">{fmt(r.repliesSent)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <PhoneArrowUpRightIcon className="h-4 w-4 text-amber-500" />
                    <span className="text-gray-600">Forwards:</span>
                    <span className="font-medium">{fmt(r.forwards)}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-indigo-50 p-2">
                      <p className="text-lg font-bold text-indigo-700">{fmt(r.vendorReqs)}</p>
                      <p className="text-[10px] text-indigo-600">Vendor Reqs</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-2">
                      <p className="text-lg font-bold text-green-700">{fmt(r.submissionsSent)}</p>
                      <p className="text-[10px] text-green-600">Submissions</p>
                    </div>
                    <div className="rounded-lg bg-purple-50 p-2">
                      <p className="text-lg font-bold text-purple-700">{fmt(r.interviewRelated)}</p>
                      <p className="text-[10px] text-purple-600">Interviews</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Daily Activity Heatmap */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Daily Activity (Last 30 Days)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4">Recruiter</th>
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4 text-right">Total</th>
                    <th className="pb-2 pr-4 text-right">Sent</th>
                    <th className="pb-2 pr-4 text-right">Received</th>
                    <th className="pb-2 text-right">Vendor Reqs</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.dailyActivity?.slice(0, 50).map((d: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 pr-4 capitalize">{d.email?.split('@')[0]}</td>
                      <td className="py-2 pr-4 text-gray-500">{new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                      <td className="py-2 pr-4 text-right font-medium">{fmt(d.total)}</td>
                      <td className="py-2 pr-4 text-right">{fmt(d.sent)}</td>
                      <td className="py-2 pr-4 text-right">{fmt(d.received)}</td>
                      <td className="py-2 text-right">
                        <span className={d.vendorReqs > 50 ? 'font-medium text-green-600' : ''}>{fmt(d.vendorReqs)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Tab 2: Email Pipeline ═══ */}
      {activeTab === 'pipeline' && pipeline && (
        <div className="space-y-6">
          {/* Pipeline funnel per recruiter */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {pipeline.pipeline?.map((p: any) => (
              <div key={p.email} className="rounded-xl border bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold capitalize mb-1">{p.name}</h3>
                <p className="text-xs text-gray-500 mb-4">{p.email}</p>

                {/* Funnel visualization */}
                <div className="space-y-2">
                  {[
                    { label: 'Openings Received', value: p.openingsReceived, color: 'bg-indigo-500' },
                    { label: 'Submissions Sent', value: p.submissionsSent, color: 'bg-blue-500' },
                    { label: 'Vendor Replies', value: p.vendorReplies, color: 'bg-green-500' },
                    { label: 'Interview Signals', value: p.interviewSignals, color: 'bg-purple-500' },
                    { label: 'Offer Signals', value: p.offerSignals, color: 'bg-emerald-500' },
                  ].map((stage) => {
                    const maxVal = Math.max(p.openingsReceived || 1, 1);
                    const width = Math.max((stage.value / maxVal) * 100, 2);
                    return (
                      <div key={stage.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">{stage.label}</span>
                          <span className="font-medium">{fmt(stage.value)}</span>
                        </div>
                        <div className="h-4 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full ${stage.color} transition-all`} style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Engagement Rate</span>
                  <span className={`text-lg font-bold ${Number(p.engagementRate) >= 5 ? 'text-green-600' : Number(p.engagementRate) >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {pct(p.engagementRate)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Weekly trend table */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Weekly Pipeline Trend (90 Days)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4">Week</th>
                    <th className="pb-2 pr-4">Recruiter</th>
                    <th className="pb-2 pr-4 text-right">Openings</th>
                    <th className="pb-2 pr-4 text-right">Submissions</th>
                    <th className="pb-2 text-right">Interviews</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.weeklyTrend?.slice(0, 40).map((w: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 pr-4 text-gray-500">{new Date(w.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                      <td className="py-2 pr-4 capitalize">{w.email?.split('@')[0]}</td>
                      <td className="py-2 pr-4 text-right font-medium">{fmt(w.openings)}</td>
                      <td className="py-2 pr-4 text-right">{fmt(w.submissions)}</td>
                      <td className="py-2 text-right">{fmt(w.interviews)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Tab 3: Email Quality ═══ */}
      {activeTab === 'quality' && quality && (
        <div className="space-y-6">
          {/* Quality tier breakdown */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {quality.qualityBreakdown?.map((tier: any) => (
              <div key={tier.tier} className="rounded-xl border bg-white p-5 shadow-sm text-center">
                <QualityTierBadge tier={tier.tier} />
                <p className="text-3xl font-bold mt-3 text-gray-900">{fmt(tier.count)}</p>
                <p className="text-xs text-gray-500 mt-1">Avg Score: {tier.avgActionScore}</p>
                <div className="mt-3 space-y-1 text-xs text-left text-gray-500">
                  <div className="flex justify-between"><span>With Rate</span><span className="font-medium text-gray-700">{fmt(tier.withRate)}</span></div>
                  <div className="flex justify-between"><span>With Skills</span><span className="font-medium text-gray-700">{fmt(tier.withSkills)}</span></div>
                  <div className="flex justify-between"><span>C2C/W2</span><span className="font-medium text-gray-700">{fmt(tier.c2cOrW2)}</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Junk patterns */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
              Junk Detection Patterns
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {quality.junkPatterns?.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                  <span className="text-sm text-gray-700">{p.pattern}</span>
                  <span className="text-sm font-bold text-red-600">{fmt(p.count)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quality Strategy */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
              AI Quality Strategy Recommendations
            </h3>
            <ul className="space-y-3">
              {quality.qualityStrategy?.map((s: string, i: number) => (
                <li key={i} className="flex gap-3 items-start">
                  <ArrowTrendingUpIcon className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-700">{s}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
