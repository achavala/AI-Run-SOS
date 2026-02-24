'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  RocketLaunchIcon,
  BoltIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  SparklesIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  UserGroupIcon,
  FireIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function ScoreBadge({ score, label }: { score: number | null; label?: string }) {
  if (score == null) return null;
  const color = score >= 80 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label || score}</span>;
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    HIGH: 'bg-green-100 text-green-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    LOW: 'bg-orange-100 text-orange-800',
    JUNK: 'bg-red-100 text-red-800',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[tier] || 'bg-gray-100 text-gray-600'}`}>{tier}</span>;
}

function EmpBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const colors: Record<string, string> = {
    C2C: 'bg-emerald-100 text-emerald-700',
    W2: 'bg-blue-100 text-blue-700',
    CONTRACT: 'bg-purple-100 text-purple-700',
    C2H: 'bg-amber-100 text-amber-700',
    FTE: 'bg-gray-100 text-gray-600',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-600'}`}>{type}</span>;
}

export default function CommandCenterPage() {
  const [plan, setPlan] = useState<any>(null);
  const [trustDist, setTrustDist] = useState<any[]>([]);
  const [topVendors, setTopVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'morning' | 'midday' | 'evening'>('morning');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [planData, distData, vendorData] = await Promise.all([
        api.get<any>('/command-center/autopilot-plan'),
        api.get<any[]>('/vendor-trust/distribution'),
        api.get<any[]>('/vendor-trust/top?limit=15'),
      ]);
      setPlan(planData);
      setTrustDist(distData);
      setTopVendors(vendorData);
    } catch (err) {
      console.error('Failed to fetch command center data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!plan) {
    return <div className="p-8 text-gray-400">Failed to load autopilot plan</div>;
  }

  const morning = plan.morning || {};
  const midday = plan.midday || {};
  const evening = plan.evening || {};

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Command Center"
        description="AI Autopilot — Daily Closure Engine"
      />

      {/* Section tabs */}
      <div className="flex gap-2">
        {[
          { id: 'morning' as const, label: 'Morning Sprint', icon: RocketLaunchIcon, color: 'indigo' },
          { id: 'midday' as const, label: 'Midday Check', icon: ClockIcon, color: 'amber' },
          { id: 'evening' as const, label: 'Evening Review', icon: FireIcon, color: 'rose' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeSection === s.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <s.icon className="h-4 w-4" />
            {s.label}
          </button>
        ))}
        <button
          onClick={fetchData}
          className="ml-auto flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Morning Sprint */}
      {activeSection === 'morning' && (
        <div className="space-y-6">
          {/* Quota bar */}
          <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-indigo-900">Daily Submission Quota</h3>
                <p className="mt-1 text-sm text-indigo-600">{morning.message}</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-indigo-600">{morning.submissionQuota}</div>
                <div className="text-sm text-indigo-400">remaining today</div>
              </div>
            </div>
          </div>

          {/* Actionable Reqs */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <BoltIcon className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold text-gray-900">Top Actionable Reqs</h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{morning.actionableReqs?.length || 0}</span>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {(morning.actionableReqs || []).slice(0, 15).map((req: any) => (
                <div key={req.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{req.title}</span>
                      <EmpBadge type={req.employmentType} />
                      <ScoreBadge score={req.actionabilityScore} label={`${req.actionabilityScore}pts`} />
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                      {req.vendorName && (
                        <span className="flex items-center gap-1">
                          <ShieldCheckIcon className="h-3 w-3" />
                          {req.vendorName}
                          {req.vendorTier && <TierBadge tier={req.vendorTier} />}
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
                        <span className="flex items-center gap-1">
                          <EnvelopeIcon className="h-3 w-3" />
                          {req.contactEmail}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Bench Matches */}
          {morning.benchMatches?.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="h-5 w-5 text-purple-500" />
                  <h3 className="font-semibold text-gray-900">Ready Bench Matches</h3>
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">{morning.benchMatches.length}</span>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {morning.benchMatches.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">{m.title}</span>
                        <EmpBadge type={m.employmentType} />
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <UserGroupIcon className="h-3 w-3 text-purple-500" />
                          <span className="font-medium text-purple-700">{m.consultantName}</span>
                          <span>({m.skill_overlap} skill overlap)</span>
                        </span>
                        {m.vendorName && <span>{m.vendorName}</span>}
                        {m.contactEmail && <span>{m.contactEmail}</span>}
                      </div>
                    </div>
                    <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                      Quick Submit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Midday Check */}
      {activeSection === 'midday' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Follow-ups Due */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4">
                <ClockIcon className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold text-gray-900">Follow-ups Due</h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{midday.followupsDue?.length || 0}</span>
              </div>
              <div className="p-6">
                {midday.followupsDue?.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <CheckCircleIcon className="mx-auto h-8 w-8 mb-2" />
                    <p>All caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(midday.followupsDue || []).slice(0, 10).map((fu: any) => (
                      <div key={fu.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Follow-up #{fu.number}</p>
                          <p className="text-xs text-gray-500">Scheduled: {fmtDate(fu.scheduledAt)}</p>
                        </div>
                        <button className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200">
                          Send
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stuck Submissions */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                <h3 className="font-semibold text-gray-900">Stuck Submissions (&gt;48h)</h3>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{midday.stuckSubmissions?.length || 0}</span>
              </div>
              <div className="p-6">
                {midday.stuckSubmissions?.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <CheckCircleIcon className="mx-auto h-8 w-8 mb-2" />
                    <p>No stuck submissions</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(midday.stuckSubmissions || []).map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Submission {s.id.slice(0, 8)}</p>
                          <p className="text-xs text-red-600">Stuck for {Math.round(s.stuckHours || 0)}h</p>
                        </div>
                        <button className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200">
                          Escalate
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm text-amber-800">{midday.message || 'Review midday progress and follow up on pending items.'}</p>
          </div>
        </div>
      )}

      {/* Evening Review */}
      {activeSection === 'evening' && (
        <div className="space-y-6">
          {/* Today's Activity */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Submissions Sent', value: evening?.todayActivity?.submissionsSent || 0, cls: 'text-indigo-600' },
              { label: 'Responses', value: evening?.todayActivity?.responsesReceived || 0, cls: 'text-green-600' },
              { label: 'Interviews', value: evening?.todayActivity?.interviewsScheduled || 0, cls: 'text-purple-600' },
              { label: 'Closure Prob.', value: `${evening?.closureProbability || 0}%`, cls: 'text-amber-600' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className={`mt-1 text-2xl font-bold ${stat.cls}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Vendor Leaderboard */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4">
              <ShieldCheckIcon className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold text-gray-900">Vendor Trust Leaderboard</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Vendor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Trust</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Tier</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Reqs (30d)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Rate %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(topVendors || []).map((v: any, i: number) => (
                    <tr key={v.id || i} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <div className="font-medium text-gray-900">{v.vendor_name}</div>
                        <div className="text-xs text-gray-400">{v.domain}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ScoreBadge score={v.trust_score} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <TierBadge tier={v.actionability_tier} />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{v.req_count_30d}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{v.has_rate_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trust Distribution */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 font-semibold text-gray-900">Vendor Trust Distribution</h3>
            <div className="flex gap-4">
              {(trustDist || []).map((d: any) => (
                <div key={d.tier} className="flex-1 rounded-lg border border-gray-100 p-4 text-center">
                  <TierBadge tier={d.tier} />
                  <p className="mt-2 text-2xl font-bold text-gray-900">{d.count}</p>
                  <p className="text-xs text-gray-500">avg score: {d.avg_score}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
            <p className="text-sm text-rose-800">{evening.message || 'End-of-day summary — review progress and plan tomorrow.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
