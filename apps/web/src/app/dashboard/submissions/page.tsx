'use client';

import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { DataTable, type Column } from '@/components/data-table';
import { DocumentPlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

const PIPELINE_STAGES = [
  { key: 'DRAFT', label: 'Draft', color: 'bg-gray-400' },
  { key: 'PENDING_CONSENT', label: 'Pending Consent', color: 'bg-amber-400' },
  { key: 'SUBMITTED', label: 'Submitted', color: 'bg-blue-500' },
  { key: 'SHORTLISTED', label: 'Shortlisted', color: 'bg-indigo-500' },
  { key: 'REJECTED', label: 'Rejected', color: 'bg-red-400' },
  { key: 'WITHDRAWN', label: 'Withdrawn', color: 'bg-gray-300' },
];

const SUBMISSIONS = [
  { id: 'S-2001', consultant: 'Sarah Chen', job: 'Sr. React Developer', vendor: 'TechStream Solutions', matchScore: 92, status: 'SUBMITTED', rate: 88, submittedAt: '2026-02-17' },
  { id: 'S-2002', consultant: 'Alex Thompson', job: 'Sr. React Developer', vendor: 'TechStream Solutions', matchScore: 85, status: 'SHORTLISTED', rate: 82, submittedAt: '2026-02-17' },
  { id: 'S-2003', consultant: 'Jordan Blake', job: 'Sr. React Developer', vendor: 'TechStream Solutions', matchScore: 74, status: 'SUBMITTED', rate: 78, submittedAt: '2026-02-18' },
  { id: 'S-2004', consultant: 'Priya Sharma', job: 'Sr. React Developer', vendor: 'TechStream Solutions', matchScore: 68, status: 'PENDING_CONSENT', rate: 95, submittedAt: '2026-02-19' },
  { id: 'S-2005', consultant: 'Derek Moss', job: 'Sr. React Developer', vendor: 'TechStream Solutions', matchScore: 61, status: 'REJECTED', rate: 80, submittedAt: '2026-02-17' },
  { id: 'S-2006', consultant: 'Nina Patel', job: 'Sr. React Developer', vendor: 'TechStream Solutions', matchScore: 88, status: 'SUBMITTED', rate: 90, submittedAt: '2026-02-20' },
  { id: 'S-2010', consultant: 'Ravi Patel', job: 'Cloud Infra Engineer', vendor: 'Apex Staffing', matchScore: 90, status: 'SHORTLISTED', rate: 95, submittedAt: '2026-02-15' },
  { id: 'S-2011', consultant: 'Maria Garcia', job: 'Data Engineer', vendor: 'NovaTech Partners', matchScore: 94, status: 'SUBMITTED', rate: 80, submittedAt: '2026-02-18' },
  { id: 'S-2012', consultant: 'Michael Lee', job: 'DevOps Lead', vendor: 'TechStream Solutions', matchScore: 82, status: 'PENDING_CONSENT', rate: 92, submittedAt: '2026-02-20' },
  { id: 'S-2013', consultant: 'Emily Rodriguez', job: 'iOS Engineer', vendor: 'Velocity Talent', matchScore: 78, status: 'DRAFT', rate: 85, submittedAt: '2026-02-21' },
  { id: 'S-2014', consultant: 'James Wilson', job: 'Full Stack Developer', vendor: 'ProConnect Inc.', matchScore: 76, status: 'SUBMITTED', rate: 90, submittedAt: '2026-02-16' },
  { id: 'S-2015', consultant: 'Amit Desai', job: 'Cloud Infra Engineer', vendor: 'Apex Staffing', matchScore: 70, status: 'WITHDRAWN', rate: 88, submittedAt: '2026-02-12' },
];

type SubRow = (typeof SUBMISSIONS)[number] & Record<string, unknown>;

const columns: Column<SubRow>[] = [
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
    render: (row) => <span className="font-medium text-gray-900">{row.consultant}</span>,
  },
  {
    key: 'job',
    header: 'Job',
    sortable: true,
    render: (row) => (
      <div>
        <p className="text-sm text-gray-900">{row.job}</p>
        <p className="text-xs text-gray-500">{row.vendor}</p>
      </div>
    ),
  },
  {
    key: 'matchScore',
    header: 'Match',
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-12 rounded-full bg-gray-200">
          <div
            className={`h-1.5 rounded-full ${
              row.matchScore >= 80 ? 'bg-emerald-500' : row.matchScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${row.matchScore}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-gray-700">{row.matchScore}%</span>
      </div>
    ),
  },
  {
    key: 'rate',
    header: 'Rate',
    sortable: true,
    render: (row) => <span className="font-medium">${row.rate}/hr</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'submittedAt',
    header: 'Date',
    sortable: true,
    render: (row) => (
      <span className="text-xs text-gray-500">
        {new Date(row.submittedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}
      </span>
    ),
  },
];

export default function SubmissionsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = SUBMISSIONS.filter((s) => {
    const matchesSearch =
      !search ||
      s.consultant.toLowerCase().includes(search.toLowerCase()) ||
      s.job.toLowerCase().includes(search.toLowerCase()) ||
      s.vendor.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: SUBMISSIONS.filter((s) => s.status === stage.key).length,
  }));

  return (
    <>
      <PageHeader
        title="Submissions"
        description="Track and manage all candidate submissions across jobs"
        actions={
          <button className="btn-primary">
            <DocumentPlusIcon className="h-4 w-4" />
            New Submission
          </button>
        }
      />

      {/* Pipeline stages overview */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statusCounts.map((stage) => (
          <button
            key={stage.key}
            onClick={() =>
              setStatusFilter(statusFilter === stage.key ? 'all' : stage.key)
            }
            className={`rounded-xl border p-4 text-left transition-all ${
              statusFilter === stage.key
                ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
              <span className="text-xs font-medium text-gray-500">{stage.label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{stage.count}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative sm:max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search submissions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered as unknown as SubRow[]}
        keyField="id"
        emptyMessage="No submissions match your filters"
      />
    </>
  );
}
