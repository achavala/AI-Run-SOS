'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { DataTable, type Column } from '@/components/data-table';
import { api } from '@/lib/api';
import {
  BuildingOfficeIcon,
  ClockIcon,
  ChartBarIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';

interface Vendor {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  trustScore: number | null;
  avgPayDays: number | null;
  ghostRate: number | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  activeJobCount: number;
  totalRevenue: number;
  msaStatus: string | null;
  createdAt: string;
}

type VendorRow = Vendor & Record<string, unknown>;

function trustScoreColor(score: number): string {
  if (score > 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

const vendorColumns: Column<VendorRow>[] = [
  {
    key: 'name',
    header: 'Vendor',
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.name}</p>
        {row.contactName && (
          <p className="text-xs text-gray-500">{row.contactName}</p>
        )}
      </div>
    ),
  },
  {
    key: 'trustScore',
    header: 'Trust Score',
    sortable: true,
    render: (row) => {
      const score = row.trustScore;
      if (score == null) return <span className="text-xs text-gray-400">N/A</span>;
      return (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-gray-200">
            <div
              className={`h-1.5 rounded-full ${trustScoreColor(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-900">{score}</span>
        </div>
      );
    },
  },
  {
    key: 'avgPayDays',
    header: 'Pay Speed',
    sortable: true,
    render: (row) => {
      const days = row.avgPayDays;
      if (days == null) return <span className="text-xs text-gray-400">N/A</span>;
      return (
        <span
          className={`text-sm font-medium ${
            days <= 15 ? 'text-emerald-600' : days <= 30 ? 'text-amber-600' : 'text-red-600'
          }`}
        >
          {days} days
        </span>
      );
    },
  },
  {
    key: 'ghostRate',
    header: 'Ghost %',
    sortable: true,
    render: (row) => {
      const rate = row.ghostRate;
      if (rate == null) return <span className="text-xs text-gray-400">N/A</span>;
      return (
        <span
          className={`text-sm ${
            rate <= 5 ? 'text-emerald-600' : rate <= 10 ? 'text-amber-600' : 'text-red-600'
          }`}
        >
          {rate}%
        </span>
      );
    },
  },
  {
    key: 'activeJobCount',
    header: 'Jobs',
    sortable: true,
    className: 'text-center',
    render: (row) => <span className="font-medium">{row.activeJobCount}</span>,
  },
  {
    key: 'totalRevenue',
    header: 'Revenue',
    sortable: true,
    render: (row) => {
      const rev = row.totalRevenue;
      if (!rev) return <span className="text-xs text-gray-400">—</span>;
      return (
        <span className="font-medium text-gray-900">
          ${rev >= 1000 ? `${(rev / 1000).toFixed(0)}K` : rev.toFixed(0)}
        </span>
      );
    },
  },
];

interface DealPipeline {
  [status: string]: number;
}

interface SalesDashboard {
  vendorStats: Array<{
    id: string;
    companyName: string;
    msaStatus: string | null;
    trustScore: number | null;
    paySpeedDays: number | null;
    ghostRate: number | null;
    activeJobs: number;
    totalInvoices: number;
    activePlacements: number;
  }>;
  dealPipeline: DealPipeline;
  monthlyProjection: {
    estimatedRevenue: number;
    estimatedMargin: number;
    activePlacements: number;
  };
}

const PIPELINE_STAGES = [
  { key: 'NEW', label: 'New', color: 'bg-gray-400' },
  { key: 'QUALIFYING', label: 'Qualifying', color: 'bg-blue-400' },
  { key: 'ACTIVE', label: 'Active', color: 'bg-indigo-500' },
  { key: 'ON_HOLD', label: 'On Hold', color: 'bg-amber-400' },
  { key: 'FILLED', label: 'Filled', color: 'bg-emerald-500' },
  { key: 'CANCELLED', label: 'Cancelled', color: 'bg-red-400' },
];

export default function SalesPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [dealPipeline, setDealPipeline] = useState<DealPipeline>({});
  const [monthlyProjection, setMonthlyProjection] = useState<{ estimatedRevenue: number; estimatedMargin: number; activePlacements: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [vendorData, salesData] = await Promise.all([
          api.get<Vendor[]>('/vendors'),
          api.get<SalesDashboard>('/dashboard/sales'),
        ]);
        if (!cancelled) {
          setVendors(vendorData);
          setDealPipeline(salesData.dealPipeline || {});
          setMonthlyProjection(salesData.monthlyProjection || null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load vendors');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = search
    ? vendors.filter((v) =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.contactName?.toLowerCase().includes(search.toLowerCase()) ||
        v.domain?.toLowerCase().includes(search.toLowerCase()),
      )
    : vendors;

  const activeVendors = vendors.filter((v) => v.activeJobCount > 0);

  const avgTrust =
    vendors.length > 0
      ? Math.round(
          vendors.reduce((sum, v) => sum + (v.trustScore ?? 0), 0) /
            vendors.filter((v) => v.trustScore != null).length || 0,
        )
      : 0;

  const vendorsWithPay = vendors.filter((v) => v.avgPayDays != null);
  const avgPayDays =
    vendorsWithPay.length > 0
      ? Math.round(
          vendorsWithPay.reduce((sum, v) => sum + (v.avgPayDays ?? 0), 0) / vendorsWithPay.length,
        )
      : 0;

  const totalRevenue = vendors.reduce((sum, v) => sum + (v.totalRevenue ?? 0), 0);

  if (loading) {
    return (
      <>
        <PageHeader
          title="Sales Dashboard"
          description="Vendor relationships, trust scores, and deal pipeline"
        />
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader
          title="Sales Dashboard"
          description="Vendor relationships, trust scores, and deal pipeline"
        />
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-800">Failed to load sales data</p>
          <p className="mt-1 text-xs text-red-600">{error}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Sales Dashboard"
        description="Vendor relationships, trust scores, and deal pipeline"
        actions={
          <button className="btn-primary">
            <BuildingOfficeIcon className="h-4 w-4" />
            Add Vendor
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Active Vendors"
          value={String(activeVendors.length)}
          subtitle={`of ${vendors.length} total`}
          icon={BuildingOfficeIcon}
        />
        <KpiCard
          title="Avg Trust Score"
          value={String(avgTrust)}
          subtitle="across vendors"
          icon={TrophyIcon}
        />
        <KpiCard
          title="Avg Pay Speed"
          value={avgPayDays ? `${avgPayDays}d` : 'N/A'}
          subtitle="days to payment"
          icon={ClockIcon}
        />
        <KpiCard
          title="Total Revenue"
          value={totalRevenue >= 1000 ? `$${(totalRevenue / 1000).toFixed(0)}K` : `$${totalRevenue}`}
          subtitle="all vendors"
          icon={ChartBarIcon}
        />
      </div>

      {/* Vendor Table */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Vendor Directory
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({filtered.length})
            </span>
          </h2>
          <input
            type="text"
            placeholder="Search vendors..."
            className="input w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <DataTable
          columns={vendorColumns}
          data={filtered as VendorRow[]}
          keyField="id"
          emptyMessage="No vendors found"
        />
      </div>

      {/* Deal Pipeline */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Deal Pipeline</h3>
            <p className="text-xs text-gray-500">Job status distribution across vendors</p>
          </div>
          {monthlyProjection && monthlyProjection.activePlacements > 0 && (
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                ${(monthlyProjection.estimatedRevenue / 1000).toFixed(0)}K
                <span className="ml-1 text-xs font-normal text-gray-400">projected/mo</span>
              </p>
              <p className="text-xs text-emerald-600">
                ${(monthlyProjection.estimatedMargin / 1000).toFixed(0)}K margin
                &middot; {monthlyProjection.activePlacements} placements
              </p>
            </div>
          )}
        </div>
        {Object.keys(dealPipeline).length === 0 ? (
          <div className="flex items-center justify-center py-12 text-center">
            <div>
              <ChartBarIcon className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-400">No jobs in pipeline yet</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-3">
            {PIPELINE_STAGES.map((stage) => {
              const count = dealPipeline[stage.key] || 0;
              const total = Object.values(dealPipeline).reduce((s, v) => s + v, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={stage.key} className="flex-1 rounded-lg border border-gray-100 p-3 text-center">
                  <div className={`mx-auto mb-2 h-2 w-full rounded-full bg-gray-100`}>
                    <div className={`h-2 rounded-full ${stage.color}`} style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }} />
                  </div>
                  <p className="text-lg font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500">{stage.label}</p>
                  {pct > 0 && <p className="text-[10px] text-gray-400">{pct}%</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
