'use client';

import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { DataTable, type Column } from '@/components/data-table';
import {
  BanknotesIcon,
  ClockIcon,
  ChartBarIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

const INVOICES = [
  {
    id: 'INV-1042',
    vendor: 'TechStream Solutions',
    amount: 18400,
    issueDate: '2026-01-12',
    dueDate: '2026-02-11',
    status: 'OVERDUE',
    daysOutstanding: 45,
  },
  {
    id: 'INV-1038',
    vendor: 'ProConnect Inc.',
    amount: 12200,
    issueDate: '2026-01-18',
    dueDate: '2026-02-17',
    status: 'OVERDUE',
    daysOutstanding: 38,
  },
  {
    id: 'INV-1045',
    vendor: 'Apex Staffing Group',
    amount: 28600,
    issueDate: '2026-01-25',
    dueDate: '2026-02-24',
    status: 'SENT',
    daysOutstanding: 27,
  },
  {
    id: 'INV-1048',
    vendor: 'NovaTech Partners',
    amount: 15800,
    issueDate: '2026-02-01',
    dueDate: '2026-03-03',
    status: 'SENT',
    daysOutstanding: 20,
  },
  {
    id: 'INV-1050',
    vendor: 'TechStream Solutions',
    amount: 22400,
    issueDate: '2026-02-05',
    dueDate: '2026-03-07',
    status: 'SENT',
    daysOutstanding: 16,
  },
  {
    id: 'INV-1052',
    vendor: 'Velocity Talent',
    amount: 8900,
    issueDate: '2026-02-10',
    dueDate: '2026-03-12',
    status: 'DRAFT',
    daysOutstanding: 11,
  },
  {
    id: 'INV-1035',
    vendor: 'NovaTech Partners',
    amount: 22800,
    issueDate: '2026-01-05',
    dueDate: '2026-02-04',
    status: 'PAID',
    daysOutstanding: 0,
  },
  {
    id: 'INV-1033',
    vendor: 'Apex Staffing Group',
    amount: 31200,
    issueDate: '2025-12-28',
    dueDate: '2026-01-27',
    status: 'PAID',
    daysOutstanding: 0,
  },
];

const AR_AGING = [
  { bucket: 'Current (0-30d)', amount: 66800, count: 3, color: 'bg-emerald-500' },
  { bucket: '31-60 days', amount: 30600, count: 2, color: 'bg-amber-500' },
  { bucket: '61-90 days', amount: 0, count: 0, color: 'bg-orange-500' },
  { bucket: '90+ days', amount: 0, count: 0, color: 'bg-red-500' },
];

const MARGIN_TREND = [
  { month: 'Sep', margin: 21.2 },
  { month: 'Oct', margin: 22.8 },
  { month: 'Nov', margin: 23.1 },
  { month: 'Dec', margin: 21.9 },
  { month: 'Jan', margin: 22.4 },
  { month: 'Feb', margin: 23.6 },
];

type InvoiceRow = (typeof INVOICES)[number] & Record<string, unknown>;

const invoiceColumns: Column<InvoiceRow>[] = [
  {
    key: 'id',
    header: 'Invoice',
    sortable: true,
    render: (row) => (
      <span className="font-mono text-xs font-medium text-indigo-600">{row.id}</span>
    ),
  },
  {
    key: 'vendor',
    header: 'Vendor',
    sortable: true,
    render: (row) => <span className="font-medium text-gray-900">{row.vendor}</span>,
  },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    render: (row) => (
      <span className="font-semibold text-gray-900">
        ${row.amount.toLocaleString()}
      </span>
    ),
  },
  {
    key: 'issueDate',
    header: 'Issued',
    sortable: true,
    render: (row) => (
      <span className="text-gray-600">
        {new Date(row.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>
    ),
  },
  {
    key: 'dueDate',
    header: 'Due',
    sortable: true,
    render: (row) => (
      <span className="text-gray-600">
        {new Date(row.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'daysOutstanding',
    header: 'Days Out',
    sortable: true,
    render: (row) => (
      <span className={`text-sm font-medium ${
        row.daysOutstanding > 30 ? 'text-red-600' : row.daysOutstanding > 15 ? 'text-amber-600' : 'text-gray-600'
      }`}>
        {row.daysOutstanding > 0 ? `${row.daysOutstanding}d` : '—'}
      </span>
    ),
  },
];

export default function AccountsPage() {
  const totalOutstanding = INVOICES.filter(
    (i) => i.status !== 'PAID' && i.status !== 'DRAFT',
  ).reduce((sum, i) => sum + i.amount, 0);

  const overdueTotal = INVOICES.filter((i) => i.status === 'OVERDUE').reduce(
    (sum, i) => sum + i.amount,
    0,
  );

  const totalAR = AR_AGING.reduce((sum, b) => sum + b.amount, 0);

  return (
    <>
      <PageHeader
        title="Accounts Dashboard"
        description="AR aging, invoices, margins, and payment tracking"
        actions={
          <button className="btn-primary">
            <BanknotesIcon className="h-4 w-4" />
            Create Invoice
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Outstanding AR"
          value={`$${(totalOutstanding / 1000).toFixed(1)}K`}
          change="+$12.4K"
          changeType="negative"
          subtitle="vs last month"
          icon={BanknotesIcon}
        />
        <KpiCard
          title="Overdue Invoices"
          value={`$${(overdueTotal / 1000).toFixed(1)}K`}
          change="2 invoices"
          changeType="negative"
          subtitle="> 30 days"
          icon={ClockIcon}
        />
        <KpiCard
          title="Margin Trend"
          value="23.6%"
          change="+1.2%"
          changeType="positive"
          subtitle="this month"
          icon={ChartBarIcon}
        />
        <KpiCard
          title="Payment Velocity"
          value="18 days"
          change="-3 days"
          changeType="positive"
          subtitle="avg collection"
          icon={BoltIcon}
        />
      </div>

      {/* AR Aging + Margin */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* AR Aging */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">AR Aging Summary</h3>
          <p className="text-xs text-gray-500">Receivables by aging bucket</p>

          <div className="mt-6 space-y-4">
            {AR_AGING.map((bucket) => {
              const pct = totalAR > 0 ? (bucket.amount / totalAR) * 100 : 0;
              return (
                <div key={bucket.bucket}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{bucket.bucket}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{bucket.count} invoices</span>
                      <span className="font-semibold text-gray-900">
                        ${bucket.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full ${bucket.color} transition-all`}
                      style={{ width: `${Math.max(pct, bucket.amount > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Margin Trend */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Margin Trend</h3>
          <p className="text-xs text-gray-500">Gross margin % over last 6 months</p>

          <div className="mt-6 flex h-48 items-end gap-3">
            {MARGIN_TREND.map((m) => {
              const height = ((m.margin - 18) / 8) * 100;
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-gray-700">
                    {m.margin}%
                  </span>
                  <div
                    className="w-full rounded-t-md bg-indigo-500 transition-all hover:bg-indigo-600"
                    style={{ height: `${Math.max(height, 10)}%` }}
                  />
                  <span className="text-[10px] font-medium text-gray-500">
                    {m.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Invoice Tracker</h2>
          <div className="flex items-center gap-2">
            <select className="input w-40">
              <option value="all">All Statuses</option>
              <option value="OVERDUE">Overdue</option>
              <option value="SENT">Sent</option>
              <option value="PAID">Paid</option>
              <option value="DRAFT">Draft</option>
            </select>
            <input
              type="text"
              placeholder="Search invoices..."
              className="input w-56"
            />
          </div>
        </div>
        <DataTable
          columns={invoiceColumns}
          data={INVOICES as unknown as InvoiceRow[]}
          keyField="id"
        />
      </div>
    </>
  );
}
