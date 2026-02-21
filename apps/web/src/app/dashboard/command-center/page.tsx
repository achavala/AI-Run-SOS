'use client';

import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { StatusBadge } from '@/components/status-badge';
import {
  CurrencyDollarIcon,
  UserGroupIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const PIPELINE_STAGES = [
  { stage: 'New Leads', count: 23, value: '$1.2M', color: 'bg-indigo-500' },
  { stage: 'Qualified', count: 15, value: '$890K', color: 'bg-blue-500' },
  { stage: 'Submitted', count: 42, value: '$2.1M', color: 'bg-cyan-500' },
  { stage: 'Interview', count: 18, value: '$720K', color: 'bg-emerald-500' },
  { stage: 'Offer', count: 8, value: '$340K', color: 'bg-amber-500' },
  { stage: 'Placed', count: 5, value: '$210K', color: 'bg-green-500' },
];

const VENDOR_TRUST_SCORES = [
  { name: 'TechStream Solutions', score: 92, paySpeed: 12, jobs: 14, trend: 'up' as const },
  { name: 'Apex Staffing Group', score: 87, paySpeed: 18, jobs: 9, trend: 'up' as const },
  { name: 'NovaTech Partners', score: 84, paySpeed: 22, jobs: 7, trend: 'stable' as const },
  { name: 'ProConnect Inc.', score: 76, paySpeed: 28, jobs: 11, trend: 'down' as const },
  { name: 'Velocity Talent', score: 71, paySpeed: 35, jobs: 5, trend: 'down' as const },
  { name: 'GlobalBridge Corp', score: 68, paySpeed: 42, jobs: 3, trend: 'down' as const },
];

const RISK_ITEMS = [
  { type: 'AR Overdue', description: 'TechStream — Invoice #1042 ($18,400)', severity: 'high', daysOverdue: 45 },
  { type: 'AR Overdue', description: 'ProConnect — Invoice #1038 ($12,200)', severity: 'high', daysOverdue: 38 },
  { type: 'Margin Alert', description: 'Placement #P-2201 margin dropped below 15%', severity: 'medium', daysOverdue: 0 },
  { type: 'Compliance', description: 'Consultant visa expiring in 30 days — Rajesh K.', severity: 'medium', daysOverdue: 0 },
  { type: 'Ghost Risk', description: 'Velocity Talent — 3 ghosted submissions this month', severity: 'low', daysOverdue: 0 },
];

const RECENT_ACTIVITY = [
  { action: 'New submission', detail: 'Sarah Chen submitted to Sr. React Dev at TechStream', time: '12 min ago' },
  { action: 'Interview scheduled', detail: 'Ravi Patel — Full Stack role at Apex Staffing', time: '1 hr ago' },
  { action: 'Invoice paid', detail: 'NovaTech — Invoice #1035 ($22,800)', time: '2 hrs ago' },
  { action: 'Job posted', detail: 'Data Engineer — GlobalBridge Corp (Remote)', time: '3 hrs ago' },
  { action: 'Placement started', detail: 'Maria Garcia — Cloud Architect at ProConnect', time: '5 hrs ago' },
];

export default function CommandCenterPage() {
  return (
    <>
      <PageHeader
        title="Command Center"
        description="Real-time overview of your staffing operations"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Revenue Pipeline"
          value="$5.4M"
          change="+12.3%"
          changeType="positive"
          subtitle="vs last month"
          icon={CurrencyDollarIcon}
        />
        <KpiCard
          title="Active Placements"
          value="47"
          change="+3"
          changeType="positive"
          subtitle="this week"
          icon={UserGroupIcon}
        />
        <KpiCard
          title="Margin Health"
          value="22.4%"
          change="-1.2%"
          changeType="negative"
          subtitle="avg gross margin"
          icon={ChartBarIcon}
        />
        <KpiCard
          title="AR at Risk"
          value="$42.6K"
          change="+$8.2K"
          changeType="negative"
          subtitle="overdue > 30 days"
          icon={ExclamationTriangleIcon}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-3">
        {/* Pipeline funnel */}
        <div className="xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Submission Pipeline</h3>
            <p className="text-xs text-gray-500">Current quarter funnel</p>

            <div className="mt-6 space-y-3">
              {PIPELINE_STAGES.map((stage) => {
                const maxCount = Math.max(...PIPELINE_STAGES.map((s) => s.count));
                const width = Math.max((stage.count / maxCount) * 100, 8);
                return (
                  <div key={stage.stage} className="flex items-center gap-4">
                    <span className="w-20 text-right text-xs font-medium text-gray-500">
                      {stage.stage}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="h-8 flex-1 overflow-hidden rounded-md bg-gray-100">
                          <div
                            className={`flex h-full items-center rounded-md ${stage.color} px-3 transition-all`}
                            style={{ width: `${width}%` }}
                          >
                            <span className="text-xs font-semibold text-white">
                              {stage.count}
                            </span>
                          </div>
                        </div>
                        <span className="w-16 text-right text-xs font-medium text-gray-600">
                          {stage.value}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk heatmap */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Risk Monitor</h3>
            <p className="text-xs text-gray-500">Active alerts across operations</p>

            <div className="mt-4 space-y-3">
              {RISK_ITEMS.map((item, i) => (
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
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700">{item.type}</p>
                    <p className="text-xs text-gray-600">{item.description}</p>
                  </div>
                  {item.daysOverdue > 0 && (
                    <span className="shrink-0 text-xs font-medium text-red-600">
                      {item.daysOverdue}d overdue
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Vendor trust scores */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Vendor Trust Scores</h3>
            <p className="text-xs text-gray-500">Top vendors by trust score</p>

            <div className="mt-4 space-y-3">
              {VENDOR_TRUST_SCORES.map((vendor) => (
                <div
                  key={vendor.name}
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
                        stroke={vendor.score >= 80 ? '#22c55e' : vendor.score >= 70 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="3"
                        strokeDasharray={`${vendor.score}, 100`}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
                      {vendor.score}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{vendor.name}</p>
                    <p className="text-xs text-gray-500">
                      {vendor.jobs} jobs &middot; {vendor.paySpeed}d avg pay
                    </p>
                  </div>
                  <span className={`text-xs font-medium ${
                    vendor.trend === 'up' ? 'text-emerald-600' : vendor.trend === 'down' ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {vendor.trend === 'up' ? '↑' : vendor.trend === 'down' ? '↓' : '→'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
            <div className="mt-4 space-y-4">
              {RECENT_ACTIVITY.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="relative flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-indigo-500" />
                    {i < RECENT_ACTIVITY.length - 1 && (
                      <div className="mt-1 h-full w-px bg-gray-200" />
                    )}
                  </div>
                  <div className="-mt-0.5 pb-4">
                    <p className="text-xs font-semibold text-gray-900">{item.action}</p>
                    <p className="text-xs text-gray-500">{item.detail}</p>
                    <p className="mt-1 text-[10px] text-gray-400">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
