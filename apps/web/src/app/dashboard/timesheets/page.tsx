'use client';

import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { KpiCard } from '@/components/kpi-card';
import { DataTable, type Column } from '@/components/data-table';
import { api } from '@/lib/api';
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentArrowUpIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useState, useEffect, useCallback } from 'react';

interface Timesheet {
  id: string;
  consultant: {
    firstName: string;
    lastName: string;
  };
  assignment: {
    jobReq: {
      title: string;
      vendor: string;
    };
  } | null;
  weekStarting: string;
  totalHours: number;
  status: string;
  payRate: number;
  billRate: number;
  notes: string | null;
  createdAt: string;
}

interface TimesheetRow extends Record<string, unknown> {
  id: string;
  consultantName: string;
  placement: string;
  weekStarting: string;
  totalHours: number;
  payRate: number;
  billRate: number;
  totalBill: number;
  margin: number;
  status: string;
}

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'INVOICED', label: 'Invoiced' },
] as const;

function toRow(ts: Timesheet): TimesheetRow {
  const margin = (ts.billRate - ts.payRate) * ts.totalHours;
  return {
    id: ts.id,
    consultantName: `${ts.consultant.firstName} ${ts.consultant.lastName}`,
    placement: ts.assignment
      ? `${ts.assignment.jobReq.title} — ${ts.assignment.jobReq.vendor}`
      : 'Unassigned',
    weekStarting: ts.weekStarting,
    totalHours: ts.totalHours,
    payRate: ts.payRate,
    billRate: ts.billRate,
    totalBill: ts.billRate * ts.totalHours,
    margin,
    status: ts.status,
  };
}

const columns: Column<TimesheetRow>[] = [
  {
    key: 'consultantName',
    header: 'Consultant',
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.consultantName}</p>
        <p className="text-xs text-gray-500">{row.placement}</p>
      </div>
    ),
  },
  {
    key: 'placement',
    header: 'Placement',
    sortable: true,
    render: (row) => (
      <span className="text-sm text-gray-700">{row.placement}</span>
    ),
  },
  {
    key: 'weekStarting',
    header: 'Week',
    sortable: true,
    render: (row) => (
      <span className="text-sm text-gray-700">
        {new Date(row.weekStarting).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}
      </span>
    ),
  },
  {
    key: 'totalHours',
    header: 'Hours',
    sortable: true,
    className: 'text-center',
    render: (row) => (
      <span
        className={`font-medium ${row.totalHours < 40 ? 'text-amber-600' : 'text-gray-900'}`}
      >
        {row.totalHours}
      </span>
    ),
  },
  {
    key: 'payRate',
    header: 'Pay Rate',
    sortable: true,
    render: (row) => (
      <span className="text-sm text-gray-700">
        ${Number(row.payRate).toFixed(2)}/hr
      </span>
    ),
  },
  {
    key: 'billRate',
    header: 'Bill Rate',
    sortable: true,
    render: (row) => (
      <span className="font-medium text-gray-900">
        ${Number(row.billRate).toFixed(2)}/hr
      </span>
    ),
  },
  {
    key: 'margin',
    header: 'Margin',
    sortable: true,
    render: (row) => {
      const totalBill = row.totalBill as number;
      const pct = totalBill > 0 ? ((row.margin / totalBill) * 100).toFixed(1) : '0.0';
      return (
        <div>
          <span className="font-medium text-emerald-600">
            ${row.margin.toLocaleString()}
          </span>
          <span className="ml-1 text-xs text-gray-400">({pct}%)</span>
        </div>
      );
    },
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export default function TimesheetsPage() {
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchTimesheets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Timesheet[]>('/timesheets');
      setRows(data.map(toRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimesheets();
  }, [fetchTimesheets]);

  const filtered = rows.filter((ts) => {
    const matchesSearch =
      !search ||
      ts.consultantName.toLowerCase().includes(search.toLowerCase()) ||
      ts.placement.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || ts.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalHours = rows.reduce((sum, ts) => sum + ts.totalHours, 0);
  const totalBilled = rows.reduce((sum, ts) => sum + ts.totalBill, 0);
  const totalMargin = rows.reduce((sum, ts) => sum + ts.margin, 0);
  const pendingApproval = rows.filter((ts) => ts.status === 'SUBMITTED').length;

  const billedChange = (() => {
    if (rows.length === 0) return { text: '—', type: 'neutral' as const };
    const weeks = [...new Set(rows.map(r => r.weekStarting))].sort().reverse();
    if (weeks.length < 2) return { text: 'first period', type: 'neutral' as const };
    const currentWeek = rows.filter(r => r.weekStarting === weeks[0]).reduce((s, r) => s + r.totalBill, 0);
    const prevWeek = rows.filter(r => r.weekStarting === weeks[1]).reduce((s, r) => s + r.totalBill, 0);
    if (prevWeek === 0) return { text: 'new', type: 'positive' as const };
    const pct = ((currentWeek - prevWeek) / prevWeek * 100).toFixed(1);
    return {
      text: `${Number(pct) >= 0 ? '+' : ''}${pct}%`,
      type: (Number(pct) >= 0 ? 'positive' : 'negative') as 'positive' | 'negative',
    };
  })();

  const statusCounts = rows.reduce<Record<string, number>>((acc, ts) => {
    acc[ts.status] = (acc[ts.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Timesheets"
        description="Review, approve, and track consultant timesheets"
        actions={
          <button className="btn-primary" onClick={fetchTimesheets}>
            <DocumentArrowUpIcon className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Hours (This Period)"
          value={loading ? '—' : totalHours.toString()}
          subtitle="across all placements"
          icon={ClockIcon}
        />
        <KpiCard
          title="Total Billed"
          value={loading ? '—' : `$${(totalBilled / 1000).toFixed(1)}K`}
          change={billedChange.text}
          changeType={billedChange.type}
          subtitle="vs prior week"
          icon={CheckCircleIcon}
        />
        <KpiCard
          title="Total Margin"
          value={loading ? '—' : `$${(totalMargin / 1000).toFixed(1)}K`}
          change={
            totalBilled > 0
              ? `${((totalMargin / totalBilled) * 100).toFixed(1)}% avg`
              : '0.0% avg'
          }
          changeType="positive"
          icon={CheckCircleIcon}
        />
        <KpiCard
          title="Pending Approval"
          value={loading ? '—' : pendingApproval.toString()}
          subtitle="timesheets awaiting review"
          icon={ExclamationCircleIcon}
        />
      </div>

      {/* Filters */}
      <div className="mt-8 mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search consultant or placement..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.value;
            const count =
              tab.value === 'all' ? rows.length : statusCounts[tab.value] || 0;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 text-xs ${isActive ? 'text-gray-500' : 'text-gray-400'}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            <p className="text-sm text-gray-500">Loading timesheets…</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-12 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchTimesheets}
            className="mt-3 text-sm font-medium text-red-700 underline hover:text-red-800"
          >
            Try again
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyField="id"
          emptyMessage="No timesheets match your filters"
        />
      )}
    </>
  );
}
