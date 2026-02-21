'use client';

import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { KpiCard } from '@/components/kpi-card';
import { DataTable, type Column } from '@/components/data-table';
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentArrowUpIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

const TIMESHEETS = [
  {
    id: 'TS-3001',
    consultant: 'Sarah Chen',
    placement: 'Sr. React Dev — TechStream',
    weekEnding: '2026-02-20',
    hours: 40,
    billRate: 95,
    payRate: 85,
    totalBill: 3800,
    totalPay: 3400,
    margin: 400,
    status: 'APPROVED',
  },
  {
    id: 'TS-3002',
    consultant: 'Ravi Patel',
    placement: 'Cloud Engineer — Apex Staffing',
    weekEnding: '2026-02-20',
    hours: 40,
    billRate: 110,
    payRate: 95,
    totalBill: 4400,
    totalPay: 3800,
    margin: 600,
    status: 'SUBMITTED',
  },
  {
    id: 'TS-3003',
    consultant: 'Maria Garcia',
    placement: 'Data Engineer — NovaTech',
    weekEnding: '2026-02-20',
    hours: 36,
    billRate: 85,
    payRate: 80,
    totalBill: 3060,
    totalPay: 2880,
    margin: 180,
    status: 'SUBMITTED',
  },
  {
    id: 'TS-3004',
    consultant: 'James Wilson',
    placement: 'Backend Dev — ProConnect',
    weekEnding: '2026-02-20',
    hours: 40,
    billRate: 100,
    payRate: 90,
    totalBill: 4000,
    totalPay: 3600,
    margin: 400,
    status: 'APPROVED',
  },
  {
    id: 'TS-3005',
    consultant: 'Emily Rodriguez',
    placement: 'Mobile Dev — Velocity Talent',
    weekEnding: '2026-02-20',
    hours: 40,
    billRate: 100,
    payRate: 88,
    totalBill: 4000,
    totalPay: 3520,
    margin: 480,
    status: 'DRAFT',
  },
  {
    id: 'TS-3006',
    consultant: 'Sarah Chen',
    placement: 'Sr. React Dev — TechStream',
    weekEnding: '2026-02-13',
    hours: 40,
    billRate: 95,
    payRate: 85,
    totalBill: 3800,
    totalPay: 3400,
    margin: 400,
    status: 'INVOICED',
  },
  {
    id: 'TS-3007',
    consultant: 'Ravi Patel',
    placement: 'Cloud Engineer — Apex Staffing',
    weekEnding: '2026-02-13',
    hours: 32,
    billRate: 110,
    payRate: 95,
    totalBill: 3520,
    totalPay: 3040,
    margin: 480,
    status: 'INVOICED',
  },
  {
    id: 'TS-3008',
    consultant: 'Maria Garcia',
    placement: 'Data Engineer — NovaTech',
    weekEnding: '2026-02-13',
    hours: 40,
    billRate: 85,
    payRate: 80,
    totalBill: 3400,
    totalPay: 3200,
    margin: 200,
    status: 'REJECTED',
  },
];

type TSRow = (typeof TIMESHEETS)[number] & Record<string, unknown>;

const columns: Column<TSRow>[] = [
  {
    key: 'id',
    header: 'ID',
    sortable: true,
    className: 'w-24',
    render: (row) => (
      <span className="font-mono text-xs text-gray-500">{row.id}</span>
    ),
  },
  {
    key: 'consultant',
    header: 'Consultant',
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.consultant}</p>
        <p className="text-xs text-gray-500">{row.placement}</p>
      </div>
    ),
  },
  {
    key: 'weekEnding',
    header: 'Week Ending',
    sortable: true,
    render: (row) => (
      <span className="text-sm text-gray-700">
        {new Date(row.weekEnding).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}
      </span>
    ),
  },
  {
    key: 'hours',
    header: 'Hours',
    sortable: true,
    className: 'text-center',
    render: (row) => (
      <span className={`font-medium ${row.hours < 40 ? 'text-amber-600' : 'text-gray-900'}`}>
        {row.hours}
      </span>
    ),
  },
  {
    key: 'totalBill',
    header: 'Bill Amount',
    sortable: true,
    render: (row) => (
      <span className="font-medium text-gray-900">
        ${row.totalBill.toLocaleString()}
      </span>
    ),
  },
  {
    key: 'margin',
    header: 'Margin',
    sortable: true,
    render: (row) => {
      const pct = ((row.margin / row.totalBill) * 100).toFixed(1);
      return (
        <div>
          <span className="font-medium text-emerald-600">${row.margin}</span>
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = TIMESHEETS.filter((ts) => {
    const matchesSearch =
      !search ||
      ts.consultant.toLowerCase().includes(search.toLowerCase()) ||
      ts.placement.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || ts.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalHours = TIMESHEETS.reduce((sum, ts) => sum + ts.hours, 0);
  const totalBilled = TIMESHEETS.reduce((sum, ts) => sum + ts.totalBill, 0);
  const totalMargin = TIMESHEETS.reduce((sum, ts) => sum + ts.margin, 0);
  const pendingApproval = TIMESHEETS.filter((ts) => ts.status === 'SUBMITTED').length;

  return (
    <>
      <PageHeader
        title="Timesheets"
        description="Review, approve, and track consultant timesheets"
        actions={
          <button className="btn-primary">
            <DocumentArrowUpIcon className="h-4 w-4" />
            Bulk Approve
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Hours (This Period)"
          value={totalHours.toString()}
          subtitle="across all placements"
          icon={ClockIcon}
        />
        <KpiCard
          title="Total Billed"
          value={`$${(totalBilled / 1000).toFixed(1)}K`}
          change="+8.2%"
          changeType="positive"
          subtitle="vs last period"
          icon={CheckCircleIcon}
        />
        <KpiCard
          title="Total Margin"
          value={`$${(totalMargin / 1000).toFixed(1)}K`}
          change={`${((totalMargin / totalBilled) * 100).toFixed(1)}% avg`}
          changeType="positive"
          icon={CheckCircleIcon}
        />
        <KpiCard
          title="Pending Approval"
          value={pendingApproval.toString()}
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-44"
        >
          <option value="all">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="INVOICED">Invoiced</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered as unknown as TSRow[]}
        keyField="id"
        emptyMessage="No timesheets match your filters"
      />
    </>
  );
}
