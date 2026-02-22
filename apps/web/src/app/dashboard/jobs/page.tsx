'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { DataTable, type Column } from '@/components/data-table';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';

interface Job {
  id: string;
  title: string;
  vendorName: string;
  skills: string[];
  location: string | null;
  locationType: string;
  rateMin: number | null;
  rateMax: number | null;
  status: string;
  closureLikelihood: number | null;
  submissionCount: number;
  createdAt: string;
}

type JobRow = Job & Record<string, unknown>;

function formatRate(min: number | null, max: number | null): string {
  if (min != null && max != null) return `$${min}-${max}/hr`;
  if (min != null) return `$${min}/hr`;
  if (max != null) return `$${max}/hr`;
  return '—';
}

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
        {row.id as string}
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
          {row.title as string}
        </Link>
        <p className="text-xs text-gray-500">{row.vendorName as string}</p>
      </div>
    ),
  },
  {
    key: 'skills',
    header: 'Skills',
    render: (row) => {
      const skills = row.skills as string[];
      return (
        <div className="flex flex-wrap gap-1">
          {skills.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700"
            >
              {s}
            </span>
          ))}
          {skills.length > 3 && (
            <span className="text-[10px] text-gray-400">+{skills.length - 3}</span>
          )}
        </div>
      );
    },
  },
  {
    key: 'locationType',
    header: 'Location',
    render: (row) => (
      <div>
        <StatusBadge status={row.locationType as string} />
        <p className="mt-0.5 text-[10px] text-gray-500">{(row.location as string) ?? ''}</p>
      </div>
    ),
  },
  {
    key: 'rateRange',
    header: 'Rate',
    sortable: true,
    render: (row) => (
      <span className="font-medium">
        {formatRate(row.rateMin as number | null, row.rateMax as number | null)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status as string} />,
  },
  {
    key: 'submissionCount',
    header: 'Subs',
    sortable: true,
    className: 'text-center',
    render: (row) => (
      <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-semibold text-gray-700">
        {row.submissionCount as number}
      </span>
    ),
  },
  {
    key: 'closureLikelihood',
    header: 'Closure',
    sortable: true,
    render: (row) => {
      const likelihood = (row.closureLikelihood as number | null) ?? 0;
      return likelihood > 0 ? (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-10 rounded-full bg-gray-200">
            <div
              className={`h-1.5 rounded-full ${
                likelihood >= 70 ? 'bg-emerald-500' : likelihood >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(likelihood, 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">{likelihood}%</span>
        </div>
      ) : (
        <span className="text-xs text-gray-400">—</span>
      );
    },
  },
];

const STATUS_OPTIONS = ['All', 'NEW', 'QUALIFYING', 'ACTIVE', 'ON_HOLD', 'FILLED', 'CANCELLED'] as const;

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<Job[]>('/jobs')
      .then((data) => {
        if (!cancelled) setJobs(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load jobs');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = jobs.filter((job) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      job.title.toLowerCase().includes(q) ||
      job.vendorName.toLowerCase().includes(q) ||
      job.skills.some((s) => s.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'All' || job.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const uniqueVendors = new Set(jobs.map((j) => j.vendorName)).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-12 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Jobs"
        description={`${jobs.length} total positions across ${uniqueVendors} vendor${uniqueVendors !== 1 ? 's' : ''}`}
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
              {s === 'All' ? `All (${jobs.length})` : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered as JobRow[]}
        keyField="id"
        emptyMessage="No jobs match your filters"
      />
    </>
  );
}
