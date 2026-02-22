'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import {
  CurrencyDollarIcon,
  UserGroupIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { CommandCenterData } from '@ai-run-sos/contracts';

const POD_STYLES: Record<string, string> = {
  SWE: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  CLOUD_DEVOPS: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  DATA: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  CYBER: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

const PIPELINE_COLORS: Record<string, string> = {
  NEW_JOB: 'bg-slate-400',
  ACTIVE_JOB: 'bg-blue-500',
  SUBMITTED: 'bg-indigo-500',
  INTERVIEWING: 'bg-cyan-500',
  OFFERED: 'bg-amber-500',
  PLACED: 'bg-green-500',
};

function getScoreColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function getScoreRingColor(pct: number): string {
  if (pct >= 80) return 'ring-emerald-500/20';
  if (pct >= 50) return 'ring-amber-500/20';
  return 'ring-red-500/20';
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-500" />;
  if (trend === 'down') return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
  return <MinusIcon className="h-4 w-4 text-gray-400" />;
}

export default function CommandCenterPage() {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      const result = await api.get<CommandCenterData>('/dashboard/command-center');
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <>
        <PageHeader title="Command Center" description="Real-time overview of your staffing operations" />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Command Center" description="Real-time overview of your staffing operations" />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error ?? 'Failed to load dashboard data'}</p>
          <button onClick={() => fetchData()} className="mt-3 text-sm font-medium text-red-700 hover:text-red-900">
            Try again
          </button>
        </div>
      </>
    );
  }

  const { dailyScoreboard, podFocus, conversionFunnel, marginHealth, kpiCards, submissionPipeline, riskMonitor, vendorTrustScores, recentActivity } = data;

  const scoreboardItems = [
    { label: 'Qualified Reqs', actual: dailyScoreboard.actuals.qualifiedReqs, target: dailyScoreboard.targets.qualifiedReqs },
    { label: 'Submissions', actual: dailyScoreboard.actuals.submissions, target: dailyScoreboard.targets.submissions },
    { label: 'Interviews', actual: dailyScoreboard.actuals.interviews, target: dailyScoreboard.targets.interviews },
    { label: 'Active Offers', actual: dailyScoreboard.actuals.activeOffers, target: dailyScoreboard.targets.activeOffers },
    { label: 'Closures', actual: dailyScoreboard.actuals.closures, target: dailyScoreboard.targets.closures },
  ];

  const funnelStages = [
    { label: 'Sub → Interview', ...conversionFunnel.subToInterview },
    { label: 'Interview → Offer', ...conversionFunnel.interviewToOffer },
    { label: 'Offer → Accept', ...conversionFunnel.offerToAccept },
  ];

  const maxPipelineCount = Math.max(...submissionPipeline.map((s) => s.count), 1);

  return (
    <>
      <PageHeader
        title="Command Center"
        description="Real-time overview of your staffing operations"
        actions={
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* 1. Daily Closure Scoreboard */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Daily Closure Scoreboard</h2>
        <p className="text-xs text-gray-500">Today&apos;s targets vs actuals</p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {scoreboardItems.map((item) => {
            const pct = item.target > 0 ? (item.actual / item.target) * 100 : 0;
            const barColor = getScoreColor(pct);
            const ringColor = getScoreRingColor(pct);

            return (
              <div
                key={item.label}
                className={`rounded-lg border p-4 ring-1 ring-inset ${ringColor} ${
                  pct >= 80
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : pct >= 50
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-red-200 bg-red-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {item.actual}/{item.target}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Pod Focus + Conversion + Margin */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Pod Focus Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Pod Focus</h3>
          <p className="text-xs text-gray-500">Today&apos;s priority pod</p>

          <div className="mt-4 flex items-center gap-2">
            {podFocus.currentPod ? (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                  POD_STYLES[podFocus.currentPod] ?? 'bg-gray-50 text-gray-700 ring-gray-500/20'
                }`}
              >
                {podFocus.currentPod.replace('_', ' ')}
              </span>
            ) : (
              <span className="text-xs text-gray-400">No pod focus today</span>
            )}
          </div>

          <p className="mt-3 text-sm text-gray-600">{podFocus.reason ?? 'No rotation reason available'}</p>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-lg font-semibold text-gray-900">{podFocus.reqCount}</p>
              <p className="text-[10px] font-medium text-gray-500">Req Count</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-lg font-semibold text-gray-900">{podFocus.benchReady}</p>
              <p className="text-[10px] font-medium text-gray-500">Bench Ready</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-lg font-semibold text-emerald-600">
                {podFocus.avgMargin > 0 ? `${podFocus.avgMargin}%` : '—'}
              </p>
              <p className="text-[10px] font-medium text-gray-500">Avg Margin</p>
            </div>
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Conversion Funnel</h3>
          <p className="text-xs text-gray-500">Stage-to-stage conversion rates (30-day)</p>

          <div className="mt-5 space-y-4">
            {funnelStages.map((stage) => (
              <div key={stage.label} className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">{stage.label}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-2xl font-semibold text-gray-900">
                      {stage.current != null ? `${Math.round(stage.current * 100)}%` : '—'}
                    </span>
                    <TrendIcon trend={stage.trend} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Margin Health Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Margin Health</h3>
          <p className="text-xs text-gray-500">Today&apos;s margin metrics</p>

          <div className="mt-5 space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500">Avg margin/hr</p>
              <p className="mt-0.5 text-2xl font-semibold text-gray-900">
                {marginHealth.avgMarginHr != null ? `$${marginHealth.avgMarginHr.toFixed(2)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Margin-safe submissions %</p>
              <p className={`mt-0.5 text-2xl font-semibold ${
                (marginHealth.marginSafePct ?? 0) >= 70 ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {marginHealth.marginSafePct != null ? `${marginHealth.marginSafePct}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Override count today</p>
              <p className={`mt-0.5 text-2xl font-semibold ${
                marginHealth.overrideCount > 0 ? 'text-amber-600' : 'text-gray-900'
              }`}>
                {marginHealth.overrideCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KPI Cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Revenue Pipeline"
          value={kpiCards.revenuePipeline.formattedValue}
          change={kpiCards.revenuePipeline.change ?? undefined}
          changeType={kpiCards.revenuePipeline.changeType as 'positive' | 'negative' | 'neutral'}
          subtitle={kpiCards.revenuePipeline.subtitle}
          icon={CurrencyDollarIcon}
        />
        <KpiCard
          title="Active Placements"
          value={kpiCards.activePlacements.formattedValue}
          change={kpiCards.activePlacements.change ?? undefined}
          changeType={kpiCards.activePlacements.changeType as 'positive' | 'negative' | 'neutral'}
          subtitle={kpiCards.activePlacements.subtitle}
          icon={UserGroupIcon}
        />
        <KpiCard
          title="Margin Health"
          value={kpiCards.marginHealth.formattedValue}
          change={kpiCards.marginHealth.change ?? undefined}
          changeType={kpiCards.marginHealth.changeType as 'positive' | 'negative' | 'neutral'}
          subtitle={kpiCards.marginHealth.subtitle}
          icon={ChartBarIcon}
        />
        <KpiCard
          title="AR at Risk"
          value={kpiCards.arAtRisk.formattedValue}
          change={kpiCards.arAtRisk.change ?? undefined}
          changeType={kpiCards.arAtRisk.changeType as 'positive' | 'negative' | 'neutral'}
          subtitle={kpiCards.arAtRisk.subtitle}
          icon={ExclamationTriangleIcon}
        />
      </div>

      {/* 4. Pipeline + Risk / Vendors + Activity */}
      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-3">
        {/* Left 2/3 */}
        <div className="xl:col-span-2">
          {/* Submission Pipeline */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Pipeline Funnel</h3>
            <p className="text-xs text-gray-500">Jobs → Submissions → Placements</p>

            <div className="mt-6 space-y-3">
              {submissionPipeline.map((stage) => {
                const width = Math.max((stage.count / maxPipelineCount) * 100, 8);
                return (
                  <div key={stage.status} className="flex items-center gap-4">
                    <span className="w-28 text-right text-xs font-medium text-gray-500">
                      {stage.stage}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="h-8 flex-1 overflow-hidden rounded-md bg-gray-100">
                          <div
                            className={`flex h-full items-center rounded-md ${
                              PIPELINE_COLORS[stage.status] ?? 'bg-indigo-500'
                            } px-3 transition-all`}
                            style={{ width: `${width}%` }}
                          >
                            <span className="text-xs font-semibold text-white">
                              {stage.count}
                            </span>
                          </div>
                        </div>
                        <span className="w-20 text-right text-xs font-medium text-gray-600">
                          {formatCurrency(stage.estWeeklyRevenue)}/wk
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk Monitor */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Risk Monitor</h3>
            <p className="text-xs text-gray-500">Active alerts across operations</p>

            <div className="mt-4 space-y-3">
              {riskMonitor.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">No active risks</p>
              ) : (
                riskMonitor.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      item.severity === 'high'
                        ? 'border-red-200 bg-red-50'
                        : item.severity === 'medium'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        item.severity === 'high'
                          ? 'bg-red-500'
                          : item.severity === 'medium'
                            ? 'bg-amber-500'
                            : 'bg-gray-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-700">{item.type}</p>
                      <p className="text-xs text-gray-600">{item.description}</p>
                    </div>
                    {item.metricLabel && (
                      <span className={`shrink-0 text-xs font-medium ${
                        item.severity === 'high' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {item.metricLabel}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 1/3 */}
        <div className="space-y-6">
          {/* Vendor Trust Scores */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Vendor Trust Scores</h3>
            <p className="text-xs text-gray-500">Ranked by trust score</p>

            <div className="mt-4 space-y-3">
              {vendorTrustScores.map((vendor) => (
                <div
                  key={vendor.vendorId}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
                >
                  <div className="relative h-10 w-10 shrink-0">
                    <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={
                          vendor.score >= 80 ? '#22c55e'
                            : vendor.score >= 60 ? '#f59e0b'
                              : '#ef4444'
                        }
                        strokeWidth="3"
                        strokeDasharray={`${vendor.score}, 100`}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
                      {vendor.score}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{vendor.name}</p>
                    <p className="text-xs text-gray-500">
                      {vendor.jobs} jobs &middot; {vendor.paySpeed}d avg pay
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      vendor.trend === 'up' ? 'text-emerald-600'
                        : vendor.trend === 'down' ? 'text-red-500'
                          : 'text-gray-400'
                    }`}
                  >
                    {vendor.trend === 'up' ? '↑' : vendor.trend === 'down' ? '↓' : '→'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
            <div className="mt-4 space-y-4">
              {recentActivity.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">No recent activity</p>
              ) : (
                recentActivity.map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="relative flex flex-col items-center">
                      <div className={`h-2 w-2 rounded-full ${
                        item.isAgent ? 'bg-purple-500' : 'bg-indigo-500'
                      }`} />
                      {i < recentActivity.length - 1 && (
                        <div className="mt-1 h-full w-px bg-gray-200" />
                      )}
                    </div>
                    <div className="-mt-0.5 pb-4">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-gray-900">{item.action}</p>
                        {item.isAgent && (
                          <span className="rounded bg-purple-100 px-1 py-0.5 text-[9px] font-medium text-purple-700">
                            AI
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{item.detail}</p>
                      <p className="mt-1 text-[10px] text-gray-400">{item.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
