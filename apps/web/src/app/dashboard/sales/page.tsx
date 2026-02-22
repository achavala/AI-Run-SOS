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

export default function SalesPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.get<Vendor[]>('/vendors');
        if (!cancelled) setVendors(data);
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

      {/* Deal Pipeline - empty state until real deal data is available */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">Deal Pipeline</h3>
        <p className="text-xs text-gray-500">Active vendor negotiations</p>
        <div className="flex items-center justify-center py-12 text-center">
          <div>
            <ChartBarIcon className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-400">No active deals</p>
            <p className="text-xs text-gray-300">Deals will appear here when tracked</p>
          </div>
        </div>
      </div>
    </>
  );
}
