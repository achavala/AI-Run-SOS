'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { DataTable, type Column } from '@/components/data-table';
import {
  ArrowLeftIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const JOB = {
  id: 'J-1001',
  title: 'Senior React Developer',
  vendor: 'TechStream Solutions',
  vendorContact: 'David Park',
  vendorEmail: 'david@techstream.io',
  status: 'OPEN',
  description:
    'We are seeking an experienced Senior React Developer to join a fast-paced fintech team. The ideal candidate will have 5+ years of React experience, strong TypeScript skills, and experience building scalable SPA applications. This is a fully remote role with flexible working hours.',
  skills: ['React', 'TypeScript', 'Node.js', 'GraphQL', 'REST APIs', 'Jest'],
  location: 'Remote',
  locationType: 'REMOTE',
  rateMin: 85,
  rateMax: 95,
  rateType: 'HOURLY',
  startDate: '2026-03-01',
  durationMonths: 12,
  closureLikelihood: 78,
  createdAt: '2026-02-16',
};

const SUBMISSIONS = [
  {
    id: 'S-2001',
    consultant: 'Sarah Chen',
    email: 'sarah.chen@email.com',
    matchScore: 92,
    status: 'SUBMITTED',
    submittedAt: '2026-02-17',
    skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
    rate: 88,
    notes: 'Strong match. 6+ years React, fintech background.',
  },
  {
    id: 'S-2002',
    consultant: 'Alex Thompson',
    email: 'alex.t@email.com',
    matchScore: 85,
    status: 'SHORTLISTED',
    submittedAt: '2026-02-17',
    skills: ['React', 'Vue.js', 'TypeScript', 'CSS'],
    rate: 82,
    notes: 'Great frontend skills. Slightly less backend experience.',
  },
  {
    id: 'S-2003',
    consultant: 'Jordan Blake',
    email: 'jordan.b@email.com',
    matchScore: 74,
    status: 'SUBMITTED',
    submittedAt: '2026-02-18',
    skills: ['React', 'JavaScript', 'Node.js'],
    rate: 78,
    notes: 'Solid candidate, needs TypeScript ramp-up.',
  },
  {
    id: 'S-2004',
    consultant: 'Priya Sharma',
    email: 'priya.sharma@email.com',
    matchScore: 68,
    status: 'PENDING_CONSENT',
    submittedAt: '2026-02-19',
    skills: ['React', 'Python', 'ML'],
    rate: 95,
    notes: 'Overqualified but interested. ML background is bonus.',
  },
  {
    id: 'S-2005',
    consultant: 'Derek Moss',
    email: 'derek.m@email.com',
    matchScore: 61,
    status: 'REJECTED',
    submittedAt: '2026-02-17',
    skills: ['Angular', 'TypeScript', 'Java'],
    rate: 80,
    notes: 'Angular focus, limited React experience.',
  },
  {
    id: 'S-2006',
    consultant: 'Nina Patel',
    email: 'nina.p@email.com',
    matchScore: 88,
    status: 'SUBMITTED',
    submittedAt: '2026-02-20',
    skills: ['React', 'TypeScript', 'GraphQL', 'Next.js'],
    rate: 90,
    notes: 'Excellent match. Previous fintech experience at Stripe.',
  },
];

type SubRow = (typeof SUBMISSIONS)[number] & Record<string, unknown>;

const subColumns: Column<SubRow>[] = [
  {
    key: 'id',
    header: 'ID',
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
        <p className="text-xs text-gray-500">{row.email}</p>
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
    key: 'skills',
    header: 'Skills',
    render: (row) => (
      <div className="flex flex-wrap gap-1">
        {row.skills.map((s) => (
          <span
            key={s}
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              JOB.skills.includes(s)
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s}
          </span>
        ))}
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
];

export default function JobDetailPage() {
  const params = useParams();

  return (
    <>
      {/* Back link */}
      <Link
        href="/dashboard/jobs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back to Jobs
      </Link>

      <PageHeader
        title={JOB.title}
        description={`${JOB.vendor} — Job ${params.id}`}
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-secondary">Edit Job</button>
            <button className="btn-primary">Add Submission</button>
          </div>
        }
      />

      {/* Job details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Status + meta */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={JOB.status} size="md" />
              <StatusBadge status={JOB.locationType} size="md" />
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-gray-500">Closure likelihood:</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-20 rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${JOB.closureLikelihood}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{JOB.closureLikelihood}%</span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex items-center gap-2">
                <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Rate</p>
                  <p className="text-sm font-semibold">${JOB.rateMin}-{JOB.rateMax}/hr</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPinIcon className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Location</p>
                  <p className="text-sm font-semibold">{JOB.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Start Date</p>
                  <p className="text-sm font-semibold">
                    {new Date(JOB.startDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="text-sm font-semibold">{JOB.durationMonths} months</p>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Description</h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              {JOB.description}
            </p>
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase text-gray-500">Required Skills</h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {JOB.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Submissions */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Submissions ({SUBMISSIONS.length})
              </h2>
            </div>
            <DataTable
              columns={subColumns}
              data={SUBMISSIONS as unknown as SubRow[]}
              keyField="id"
              emptyMessage="No submissions yet"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Vendor card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Vendor</h3>
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-gray-900">{JOB.vendor}</p>
              <p className="text-sm text-gray-600">{JOB.vendorContact}</p>
              <a
                href={`mailto:${JOB.vendorEmail}`}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                {JOB.vendorEmail}
              </a>
            </div>
          </div>

          {/* Submission stats */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Submission Summary</h3>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Total', count: SUBMISSIONS.length, color: 'bg-gray-500' },
                { label: 'Shortlisted', count: SUBMISSIONS.filter((s) => s.status === 'SHORTLISTED').length, color: 'bg-blue-500' },
                { label: 'Submitted', count: SUBMISSIONS.filter((s) => s.status === 'SUBMITTED').length, color: 'bg-emerald-500' },
                { label: 'Pending Consent', count: SUBMISSIONS.filter((s) => s.status === 'PENDING_CONSENT').length, color: 'bg-amber-500' },
                { label: 'Rejected', count: SUBMISSIONS.filter((s) => s.status === 'REJECTED').length, color: 'bg-red-500' },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${stat.color}`} />
                    <span className="text-sm text-gray-600">{stat.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{stat.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Activity</h3>
            <div className="mt-4 space-y-4">
              {[
                { action: 'Nina Patel submitted', date: 'Feb 20, 2026' },
                { action: 'Priya Sharma added (pending consent)', date: 'Feb 19, 2026' },
                { action: 'Alex Thompson shortlisted', date: 'Feb 18, 2026' },
                { action: 'Derek Moss rejected', date: 'Feb 18, 2026' },
                { action: 'Sarah Chen & Jordan Blake submitted', date: 'Feb 17, 2026' },
                { action: 'Job created', date: 'Feb 16, 2026' },
              ].map((event, i, arr) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-indigo-500" />
                    {i < arr.length - 1 && <div className="mt-1 h-full w-px bg-gray-200" />}
                  </div>
                  <div className="-mt-0.5 pb-2">
                    <p className="text-xs text-gray-700">{event.action}</p>
                    <p className="text-[10px] text-gray-400">{event.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
