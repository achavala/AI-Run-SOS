'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { DataTable, type Column } from '@/components/data-table';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

const JOBS = [
  {
    id: 'J-1001',
    title: 'Senior React Developer',
    vendor: 'TechStream Solutions',
    skills: ['React', 'TypeScript', 'Node.js'],
    location: 'Remote',
    locationType: 'REMOTE',
    rateRange: '$85-95/hr',
    status: 'OPEN',
    submissions: 6,
    closureLikelihood: 78,
    createdAt: '2026-02-16',
  },
  {
    id: 'J-1002',
    title: 'Cloud Infrastructure Engineer',
    vendor: 'Apex Staffing Group',
    skills: ['AWS', 'Terraform', 'Kubernetes'],
    location: 'Austin, TX',
    locationType: 'HYBRID',
    rateRange: '$90-110/hr',
    status: 'OPEN',
    submissions: 3,
    closureLikelihood: 62,
    createdAt: '2026-02-09',
  },
  {
    id: 'J-1003',
    title: 'Data Engineer',
    vendor: 'NovaTech Partners',
    skills: ['Python', 'Spark', 'Airflow', 'SQL'],
    location: 'Remote',
    locationType: 'REMOTE',
    rateRange: '$75-85/hr',
    status: 'OPEN',
    submissions: 8,
    closureLikelihood: 85,
    createdAt: '2026-02-18',
  },
  {
    id: 'J-1004',
    title: 'Full Stack Developer',
    vendor: 'ProConnect Inc.',
    skills: ['Java', 'Spring Boot', 'Angular'],
    location: 'New York, NY',
    locationType: 'ONSITE',
    rateRange: '$80-100/hr',
    status: 'ON_HOLD',
    submissions: 2,
    closureLikelihood: 35,
    createdAt: '2026-02-01',
  },
  {
    id: 'J-1005',
    title: 'DevOps Lead',
    vendor: 'TechStream Solutions',
    skills: ['CI/CD', 'Docker', 'AWS', 'Jenkins'],
    location: 'Remote',
    locationType: 'REMOTE',
    rateRange: '$95-120/hr',
    status: 'OPEN',
    submissions: 4,
    closureLikelihood: 71,
    createdAt: '2026-02-14',
  },
  {
    id: 'J-1006',
    title: 'iOS Engineer',
    vendor: 'Velocity Talent',
    skills: ['Swift', 'UIKit', 'SwiftUI'],
    location: 'Los Angeles, CA',
    locationType: 'HYBRID',
    rateRange: '$85-100/hr',
    status: 'OPEN',
    submissions: 1,
    closureLikelihood: 44,
    createdAt: '2026-02-20',
  },
  {
    id: 'J-1007',
    title: 'ML Platform Engineer',
    vendor: 'GlobalBridge Corp',
    skills: ['Python', 'MLOps', 'Kubernetes', 'PyTorch'],
    location: 'Seattle, WA',
    locationType: 'HYBRID',
    rateRange: '$100-130/hr',
    status: 'DRAFT',
    submissions: 0,
    closureLikelihood: 0,
    createdAt: '2026-02-21',
  },
  {
    id: 'J-0998',
    title: 'QA Automation Lead',
    vendor: 'Apex Staffing Group',
    skills: ['Selenium', 'Cypress', 'Java'],
    location: 'Remote',
    locationType: 'REMOTE',
    rateRange: '$70-85/hr',
    status: 'FILLED',
    submissions: 12,
    closureLikelihood: 100,
    createdAt: '2026-01-10',
  },
];

type JobRow = (typeof JOBS)[number] & Record<string, unknown>;

const columns: Column<JobRow>[] = [
  {
    key: 'id',
    header: 'ID',
    sortable: true,
    className: 'w-24',
    render: (row) => (
      <Link
        href={`/dashboard/jobs/${row.id}`}
        className="font-mono text-xs font-medium text-indigo-600 hover:text-indigo-800"
      >
        {row.id}
      </Link>
    ),
  },
  {
    key: 'title',
    header: 'Position',
    sortable: true,
    render: (row) => (
      <div>
        <Link href={`/dashboard/jobs/${row.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
          {row.title}
        </Link>
        <p className="text-xs text-gray-500">{row.vendor}</p>
      </div>
    ),
  },
  {
    key: 'skills',
    header: 'Skills',
    render: (row) => (
      <div className="flex flex-wrap gap-1">
        {row.skills.slice(0, 3).map((s) => (
          <span
            key={s}
            className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700"
          >
            {s}
          </span>
        ))}
        {row.skills.length > 3 && (
          <span className="text-[10px] text-gray-400">+{row.skills.length - 3}</span>
        )}
      </div>
    ),
  },
  {
    key: 'locationType',
    header: 'Location',
    render: (row) => (
      <div>
        <StatusBadge status={row.locationType} />
        <p className="mt-0.5 text-[10px] text-gray-500">{row.location}</p>
      </div>
    ),
  },
  {
    key: 'rateRange',
    header: 'Rate',
    sortable: true,
    render: (row) => <span className="font-medium">{row.rateRange}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'submissions',
    header: 'Subs',
    sortable: true,
    className: 'text-center',
    render: (row) => (
      <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-semibold text-gray-700">
        {row.submissions}
      </span>
    ),
  },
  {
    key: 'closureLikelihood',
    header: 'Closure',
    sortable: true,
    render: (row) =>
      row.closureLikelihood > 0 ? (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-10 rounded-full bg-gray-200">
            <div
              className={`h-1.5 rounded-full ${
                row.closureLikelihood >= 70 ? 'bg-emerald-500' : row.closureLikelihood >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${row.closureLikelihood}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">{row.closureLikelihood}%</span>
        </div>
      ) : (
        <span className="text-xs text-gray-400">—</span>
      ),
  },
];

const STATUS_OPTIONS = ['All', 'OPEN', 'ON_HOLD', 'FILLED', 'DRAFT', 'CANCELLED'] as const;

export default function JobsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const filtered = JOBS.filter((job) => {
    const matchesSearch =
      !search ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.vendor.toLowerCase().includes(search.toLowerCase()) ||
      job.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || job.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <PageHeader
        title="Jobs"
        description={`${JOBS.length} total positions across ${new Set(JOBS.map((j) => j.vendor)).size} vendors`}
        actions={
          <button className="btn-primary">
            <PlusIcon className="h-4 w-4" />
            New Job
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs, vendors, skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {s === 'All' ? `All (${JOBS.length})` : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered as unknown as JobRow[]}
        keyField="id"
        emptyMessage="No jobs match your filters"
      />
    </>
  );
}
