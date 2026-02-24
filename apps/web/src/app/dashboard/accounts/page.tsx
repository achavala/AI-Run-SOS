'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
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

interface Invoice {
  id: string;
  invoiceNumber: string;
  vendor: { companyName: string };
  totalAmount: number;
  status: string;
  dueDate: string | null;
  sentAt: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  _count: { payments: number };
}

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  vendor: string;
  amount: number;
  dueDate: string | null;
  createdAt: string;
  status: string;
  daysOutstanding: number;
} & Record<string, unknown>;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function computeArAging(invoices: Invoice[]) {
  const now = new Date();
  const unpaid = invoices.filter(
    (i) => i.status !== 'PAID' && i.status !== 'DRAFT',
  );

  const buckets = [
    { label: 'Current (0-30d)', min: 0, max: 30, color: 'bg-emerald-500', amount: 0, count: 0 },
    { label: '31-60 days', min: 31, max: 60, color: 'bg-amber-500', amount: 0, count: 0 },
    { label: '61-90 days', min: 61, max: 90, color: 'bg-orange-500', amount: 0, count: 0 },
    { label: '90+ days', min: 91, max: Infinity, color: 'bg-red-500', amount: 0, count: 0 },
  ];

  for (const inv of unpaid) {
    const issued = new Date(inv.createdAt);
    const age = daysBetween(issued, now);
    const bucket = buckets.find((b) => age >= b.min && age <= b.max);
    if (bucket) {
      bucket.amount += inv.totalAmount;
      bucket.count += 1;
    }
  }

  return buckets;
}

function toRows(invoices: Invoice[]): InvoiceRow[] {
  const now = new Date();
  return invoices.map((inv) => {
    const isPaid = inv.status === 'PAID';
    const isDraft = inv.status === 'DRAFT';
    const age =
      isPaid || isDraft
        ? 0
        : daysBetween(new Date(inv.createdAt), now);

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      vendor: inv.vendor?.companyName ?? 'Unknown',
      amount: inv.totalAmount,
      dueDate: inv.dueDate,
      createdAt: inv.createdAt,
      status: inv.status,
      daysOutstanding: Math.max(age, 0),
    };
  });
}

const invoiceColumns: Column<InvoiceRow>[] = [
  {
    key: 'invoiceNumber',
    header: 'Invoice',
    sortable: true,
    render: (row) => (
      <span className="font-mono text-xs font-medium text-indigo-600">
        {row.invoiceNumber}
      </span>
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
    key: 'createdAt',
    header: 'Issued',
    sortable: true,
    render: (row) => (
      <span className="text-gray-600">
        {new Date(row.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}
      </span>
    ),
  },
  {
    key: 'dueDate',
    header: 'Due',
    sortable: true,
    render: (row) => (
      <span className="text-gray-600">
        {row.dueDate
          ? new Date(row.dueDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          : '—'}
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
      <span
        className={`text-sm font-medium ${
          row.daysOutstanding > 30
            ? 'text-red-600'
            : row.daysOutstanding > 15
              ? 'text-amber-600'
              : 'text-gray-600'
        }`}
      >
        {row.daysOutstanding > 0 ? `${row.daysOutstanding}d` : '—'}
      </span>
    ),
  },
];

export default function AccountsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.get<Invoice[]>('/invoices');
        if (!cancelled) setInvoices(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load invoices');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const unpaidInvoices = invoices.filter(
    (i) => i.status !== 'PAID' && i.status !== 'DRAFT',
  );
  const overdueInvoices = invoices.filter((i) => {
    if (i.status === 'PAID' || i.status === 'DRAFT' || !i.dueDate) return false;
    return new Date(i.dueDate) < new Date();
  });

  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const overdueTotal = overdueInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const overdueCount = overdueInvoices.length;

  const paidInvoices = invoices.filter((i) => i.status === 'PAID');
  const totalRevenue = paidInvoices.reduce((s, i) => s + i.totalAmount, 0);

  const avgDaysToPay = (() => {
    const withDates = paidInvoices.filter((i) => i.sentAt && i.paidAt);
    if (withDates.length === 0) return 0;
    const total = withDates.reduce(
      (s, i) => s + daysBetween(new Date(i.sentAt!), new Date(i.paidAt!)),
      0,
    );
    return Math.round(total / withDates.length);
  })();

  const arAging = computeArAging(invoices);
  const totalAR = arAging.reduce((s, b) => s + b.amount, 0);
  const rows = toRows(invoices);

  function formatCurrency(val: number): string {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    return `$${val.toLocaleString()}`;
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Accounts Dashboard"
          description="AR aging, invoices, margins, and payment tracking"
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
          title="Accounts Dashboard"
          description="AR aging, invoices, margins, and payment tracking"
        />
        <div className="rounded-xl border border-red-200 bg-red-50 p-12 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      </>
    );
  }

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
          value={formatCurrency(totalOutstanding)}
          change={`${unpaidInvoices.length} invoices`}
          changeType={totalOutstanding > 0 ? 'negative' : 'neutral'}
          subtitle="unpaid"
          icon={BanknotesIcon}
        />
        <KpiCard
          title="Overdue Invoices"
          value={formatCurrency(overdueTotal)}
          change={`${overdueCount} invoice${overdueCount !== 1 ? 's' : ''}`}
          changeType={overdueCount > 0 ? 'negative' : 'neutral'}
          subtitle="past due"
          icon={ClockIcon}
        />
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          change={`${paidInvoices.length} paid`}
          changeType={totalRevenue > 0 ? 'positive' : 'neutral'}
          subtitle="collected"
          icon={ChartBarIcon}
        />
        <KpiCard
          title="Avg Days to Pay"
          value={avgDaysToPay > 0 ? `${avgDaysToPay} days` : '—'}
          change={paidInvoices.length > 0 ? `${paidInvoices.length} samples` : 'no data'}
          changeType="neutral"
          subtitle="sent → paid"
          icon={BoltIcon}
        />
      </div>

      {/* AR Aging */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">AR Aging Summary</h3>
          <p className="text-xs text-gray-500">Receivables by aging bucket</p>

          <div className="mt-6 space-y-4">
            {arAging.map((bucket) => {
              const pct = totalAR > 0 ? (bucket.amount / totalAR) * 100 : 0;
              return (
                <div key={bucket.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{bucket.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {bucket.count} invoice{bucket.count !== 1 ? 's' : ''}
                      </span>
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

        {/* Revenue Summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Invoice Breakdown</h3>
          <p className="text-xs text-gray-500">By status</p>

          <div className="mt-6 space-y-3">
            {(['PAID', 'SENT', 'OVERDUE', 'DRAFT', 'PARTIAL', 'DISPUTED'] as const).map(
              (status) => {
                const group = invoices.filter((i) => i.status === status);
                if (group.length === 0) return null;
                const total = group.reduce((s, i) => s + i.totalAmount, 0);
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={status} />
                      <span className="text-xs text-gray-500">
                        {group.length} invoice{group.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      ${total.toLocaleString()}
                    </span>
                  </div>
                );
              },
            )}
            {invoices.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">
                No invoices yet
              </p>
            )}
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
          data={rows}
          keyField="id"
          emptyMessage="No invoices yet. Create your first invoice to get started."
        />
      </div>
    </>
  );
}
