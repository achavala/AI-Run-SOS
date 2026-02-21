'use client';

import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { DataTable, type Column } from '@/components/data-table';
import { UserPlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

const CONSULTANTS = [
  {
    id: 'C-001',
    name: 'Sarah Chen',
    email: 'sarah.chen@email.com',
    skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
    status: 'ACTIVE',
    currentPlacement: 'Sr. React Dev — TechStream',
    rate: 85,
    location: 'San Francisco, CA',
    startDate: '2025-09-15',
  },
  {
    id: 'C-002',
    name: 'Ravi Patel',
    email: 'ravi.patel@email.com',
    skills: ['AWS', 'Terraform', 'Python', 'Kubernetes'],
    status: 'ACTIVE',
    currentPlacement: 'Cloud Engineer — Apex Staffing',
    rate: 95,
    location: 'Austin, TX',
    startDate: '2025-11-01',
  },
  {
    id: 'C-003',
    name: 'Maria Garcia',
    email: 'maria.garcia@email.com',
    skills: ['Python', 'Spark', 'Airflow', 'SQL', 'dbt'],
    status: 'ACTIVE',
    currentPlacement: 'Data Engineer — NovaTech',
    rate: 80,
    location: 'Remote',
    startDate: '2025-10-20',
  },
  {
    id: 'C-004',
    name: 'James Wilson',
    email: 'james.wilson@email.com',
    skills: ['Java', 'Spring Boot', 'Microservices'],
    status: 'ACTIVE',
    currentPlacement: 'Backend Dev — ProConnect',
    rate: 90,
    location: 'New York, NY',
    startDate: '2025-08-10',
  },
  {
    id: 'C-005',
    name: 'Alex Thompson',
    email: 'alex.t@email.com',
    skills: ['React', 'Vue.js', 'CSS', 'Figma'],
    status: 'ACTIVE',
    currentPlacement: null,
    rate: 75,
    location: 'Remote',
    startDate: null,
  },
  {
    id: 'C-006',
    name: 'Priya Sharma',
    email: 'priya.sharma@email.com',
    skills: ['Machine Learning', 'Python', 'TensorFlow'],
    status: 'ACTIVE',
    currentPlacement: null,
    rate: 100,
    location: 'Seattle, WA',
    startDate: null,
  },
  {
    id: 'C-007',
    name: 'Michael Lee',
    email: 'michael.lee@email.com',
    skills: ['DevOps', 'CI/CD', 'Docker', 'Jenkins', 'AWS'],
    status: 'ACTIVE',
    currentPlacement: null,
    rate: 92,
    location: 'Denver, CO',
    startDate: null,
  },
  {
    id: 'C-008',
    name: 'Emily Rodriguez',
    email: 'emily.r@email.com',
    skills: ['iOS', 'Swift', 'React Native'],
    status: 'ACTIVE',
    currentPlacement: 'Mobile Dev — Velocity Talent',
    rate: 88,
    location: 'Los Angeles, CA',
    startDate: '2025-12-01',
  },
];

type ConsultantRow = (typeof CONSULTANTS)[number] & Record<string, unknown>;

const columns: Column<ConsultantRow>[] = [
  {
    key: 'name',
    header: 'Consultant',
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.name}</p>
        <p className="text-xs text-gray-500">{row.email}</p>
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
    key: 'currentPlacement',
    header: 'Placement',
    render: (row) =>
      row.currentPlacement ? (
        <span className="text-sm text-gray-700">{row.currentPlacement}</span>
      ) : (
        <span className="text-sm italic text-gray-400">On bench</span>
      ),
  },
  {
    key: 'rate',
    header: 'Rate',
    sortable: true,
    render: (row) => <span className="font-medium">${row.rate}/hr</span>,
  },
  {
    key: 'location',
    header: 'Location',
    sortable: true,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.currentPlacement ? 'ACTIVE' : 'OPEN'} />,
  },
];

export default function ConsultantsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'placed' | 'bench'>('all');

  const filtered = CONSULTANTS.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));

    const matchesFilter =
      filter === 'all' ||
      (filter === 'placed' && c.currentPlacement) ||
      (filter === 'bench' && !c.currentPlacement);

    return matchesSearch && matchesFilter;
  });

  const placed = CONSULTANTS.filter((c) => c.currentPlacement).length;
  const bench = CONSULTANTS.length - placed;

  return (
    <>
      <PageHeader
        title="Consultants"
        description={`${CONSULTANTS.length} total — ${placed} placed, ${bench} on bench`}
        actions={
          <button className="btn-primary">
            <UserPlusIcon className="h-4 w-4" />
            Add Consultant
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or skill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
          {(['all', 'placed', 'bench'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {f} {f === 'all' ? `(${CONSULTANTS.length})` : f === 'placed' ? `(${placed})` : `(${bench})`}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered as unknown as ConsultantRow[]}
        keyField="id"
        emptyMessage="No consultants match your search"
      />
    </>
  );
}
