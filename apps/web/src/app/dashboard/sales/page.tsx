'use client';

import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { DataTable, type Column } from '@/components/data-table';
import {
  BuildingOfficeIcon,
  DocumentCheckIcon,
  ChartBarIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';

const VENDORS = [
  {
    id: 'V-001',
    name: 'TechStream Solutions',
    contact: 'David Park',
    email: 'david@techstream.io',
    trustScore: 92,
    paySpeed: 12,
    ghostRate: 2,
    activeJobs: 14,
    revenue: 480000,
    msaStatus: 'ACTIVE',
  },
  {
    id: 'V-002',
    name: 'Apex Staffing Group',
    contact: 'Jennifer Liu',
    email: 'jliu@apexstaffing.com',
    trustScore: 87,
    paySpeed: 18,
    ghostRate: 5,
    activeJobs: 9,
    revenue: 320000,
    msaStatus: 'ACTIVE',
  },
  {
    id: 'V-003',
    name: 'NovaTech Partners',
    contact: 'Robert Chen',
    email: 'rchen@novatech.co',
    trustScore: 84,
    paySpeed: 22,
    ghostRate: 8,
    activeJobs: 7,
    revenue: 215000,
    msaStatus: 'ACTIVE',
  },
  {
    id: 'V-004',
    name: 'ProConnect Inc.',
    contact: 'Sarah Miller',
    email: 'sarah@proconnect.com',
    trustScore: 76,
    paySpeed: 28,
    ghostRate: 12,
    activeJobs: 11,
    revenue: 185000,
    msaStatus: 'ACTIVE',
  },
  {
    id: 'V-005',
    name: 'Velocity Talent',
    contact: 'Mark Johnson',
    email: 'mark@velocitytalent.com',
    trustScore: 71,
    paySpeed: 35,
    ghostRate: 15,
    activeJobs: 5,
    revenue: 94000,
    msaStatus: 'ACTIVE',
  },
  {
    id: 'V-006',
    name: 'GlobalBridge Corp',
    contact: 'Lisa Wang',
    email: 'lwang@globalbridge.io',
    trustScore: 68,
    paySpeed: 42,
    ghostRate: 20,
    activeJobs: 3,
    revenue: 62000,
    msaStatus: 'ACTIVE',
  },
];

const DEAL_PIPELINE = [
  { vendor: 'Pinnacle Systems', stage: 'Negotiation', value: '$240K', probability: 80, daysInStage: 5 },
  { vendor: 'Summit Technologies', stage: 'Proposal Sent', value: '$180K', probability: 60, daysInStage: 12 },
  { vendor: 'Horizon Digital', stage: 'Discovery', value: '$320K', probability: 30, daysInStage: 3 },
  { vendor: 'Atlas IT Group', stage: 'Contract Review', value: '$150K', probability: 90, daysInStage: 2 },
  { vendor: 'Beacon Solutions', stage: 'Proposal Sent', value: '$95K', probability: 50, daysInStage: 8 },
];

type VendorRow = (typeof VENDORS)[number] & Record<string, unknown>;

const vendorColumns: Column<VendorRow>[] = [
  {
    key: 'name',
    header: 'Vendor',
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.name}</p>
        <p className="text-xs text-gray-500">{row.contact}</p>
      </div>
    ),
  },
  {
    key: 'trustScore',
    header: 'Trust Score',
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 rounded-full bg-gray-200">
          <div
            className={`h-1.5 rounded-full ${
              row.trustScore >= 80 ? 'bg-emerald-500' : row.trustScore >= 70 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${row.trustScore}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-gray-900">{row.trustScore}</span>
      </div>
    ),
  },
  {
    key: 'paySpeed',
    header: 'Pay Speed',
    sortable: true,
    render: (row) => (
      <span className={`text-sm font-medium ${row.paySpeed <= 15 ? 'text-emerald-600' : row.paySpeed <= 30 ? 'text-amber-600' : 'text-red-600'}`}>
        {row.paySpeed} days
      </span>
    ),
  },
  {
    key: 'ghostRate',
    header: 'Ghost %',
    sortable: true,
    render: (row) => (
      <span className={`text-sm ${row.ghostRate <= 5 ? 'text-emerald-600' : row.ghostRate <= 10 ? 'text-amber-600' : 'text-red-600'}`}>
        {row.ghostRate}%
      </span>
    ),
  },
  {
    key: 'activeJobs',
    header: 'Jobs',
    sortable: true,
    className: 'text-center',
    render: (row) => <span className="font-medium">{row.activeJobs}</span>,
  },
  {
    key: 'revenue',
    header: 'Revenue',
    sortable: true,
    render: (row) => (
      <span className="font-medium text-gray-900">
        ${(row.revenue / 1000).toFixed(0)}K
      </span>
    ),
  },
];

export default function SalesPage() {
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
          value="24"
          change="+2"
          changeType="positive"
          subtitle="this month"
          icon={BuildingOfficeIcon}
        />
        <KpiCard
          title="Pending Proposals"
          value="7"
          change="-1"
          changeType="positive"
          subtitle="vs last week"
          icon={DocumentCheckIcon}
        />
        <KpiCard
          title="Win Rate"
          value="68%"
          change="+5.2%"
          changeType="positive"
          subtitle="last 90 days"
          icon={ChartBarIcon}
        />
        <KpiCard
          title="Avg Trust Score"
          value="81"
          change="+3"
          changeType="positive"
          subtitle="across vendors"
          icon={TrophyIcon}
        />
      </div>

      {/* Vendor Table */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Vendor Directory</h2>
          <input
            type="text"
            placeholder="Search vendors..."
            className="input w-64"
          />
        </div>
        <DataTable
          columns={vendorColumns}
          data={VENDORS as unknown as VendorRow[]}
          keyField="id"
        />
      </div>

      {/* Deal Pipeline */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">Deal Pipeline</h3>
        <p className="text-xs text-gray-500">Active vendor negotiations</p>

        <div className="mt-4 space-y-3">
          {DEAL_PIPELINE.map((deal, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg border border-gray-100 p-4 transition-colors hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{deal.vendor}</p>
                <p className="text-xs text-gray-500">{deal.stage} &middot; {deal.daysInStage}d in stage</p>
              </div>
              <span className="text-sm font-semibold text-gray-900">{deal.value}</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 rounded-full bg-gray-200">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500"
                    style={{ width: `${deal.probability}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-medium text-gray-600">{deal.probability}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
