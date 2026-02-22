'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { DataTable, type Column } from '@/components/data-table';
import {
  BriefcaseIcon,
  DocumentTextIcon,
  CalendarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface Job {
  id: string;
  title: string;
  vendor?: string;
  vendorName?: string;
  skills?: string[];
  location?: string;
  rate?: string;
  status: string;
  submissionCount?: number;
  submissions?: number;
  matchScore?: number;
  daysOpen?: number;
  createdAt?: string;
  [key: string]: unknown;
}

interface Submission {
  id: string;
  consultantName?: string;
  consultant?: { name: string };
  jobTitle?: string;
  job?: { title: string };
  vendorName?: string;
  status: string;
  matchScore?: number;
  createdAt: string;
  [key: string]: unknown;
}

type JobRow = Job & Record<string, unknown>;

const jobColumns: Column<JobRow>[] = [
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
    key: 'title',
    header: 'Position',
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.title}</p>
        <p className="text-xs text-gray-500">{row.vendorName ?? row.vendor ?? '—'}</p>
      </div>
    ),
  },
  {
    key: 'skills',
    header: 'Skills',
    render: (row) => {
      const skills = row.skills ?? [];
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
    key: 'rate',
    header: 'Rate',
    sortable: true,
    render: (row) => <span className="font-medium">{row.rate ?? '—'}</span>,
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
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
        {row.submissionCount ?? row.submissions ?? 0}
      </span>
    ),
  },
  {
    key: 'matchScore',
    header: 'Match',
    sortable: true,
    render: (row) => {
      const score = row.matchScore ?? 0;
      return (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-12 rounded-full bg-gray-200">
            <div
              className={`h-1.5 rounded-full ${
                score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600">{score}%</span>
        </div>
      );
    },
  },
];

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-gray-100 p-3">
        <BriefcaseIcon className="h-6 w-6 text-gray-400" />
      </div>
      <p className="mt-3 text-sm text-gray-500">{message}</p>
    </div>
  );
}

export default function RecruitmentPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [jobsRes, subsRes] = await Promise.all([
          api.get<{ data: Job[] } | Job[]>('/jobs?status=ACTIVE'),
          api.get<{ data: Submission[] } | Submission[]>('/submissions'),
        ]);

        if (cancelled) return;

        const jobsList = Array.isArray(jobsRes) ? jobsRes : jobsRes.data ?? [];
        const subsList = Array.isArray(subsRes) ? subsRes : subsRes.data ?? [];

        setJobs(jobsList);
        setSubmissions(subsList);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load recruitment data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  const todaysSubmissions = submissions.filter(
    (s) => s.createdAt && isToday(s.createdAt),
  );

  const interviewingSubmissions = submissions.filter(
    (s) => s.status === 'INTERVIEWING',
  );

  const scoredSubmissions = submissions.filter(
    (s) => typeof s.matchScore === 'number',
  );
  const avgMatchScore =
    scoredSubmissions.length > 0
      ? Math.round(
          scoredSubmissions.reduce((sum, s) => sum + (s.matchScore ?? 0), 0) /
            scoredSubmissions.length,
        )
      : 0;

  const recentSubmissions = [...submissions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  if (loading) {
    return (
      <>
        <PageHeader
          title="Recruitment Dashboard"
          description="Track open jobs, submissions, and candidate pipeline"
        />
        <Spinner />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader
          title="Recruitment Dashboard"
          description="Track open jobs, submissions, and candidate pipeline"
        />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-800">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm font-medium text-red-600 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Recruitment Dashboard"
        description="Track open jobs, submissions, and candidate pipeline"
        actions={
          <button className="btn-primary">
            <DocumentTextIcon className="h-4 w-4" />
            New Submission
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Open Jobs"
          value={String(jobs.length)}
          subtitle="active positions"
          icon={BriefcaseIcon}
        />
        <KpiCard
          title="Today's Submissions"
          value={String(todaysSubmissions.length)}
          subtitle="submitted today"
          icon={DocumentTextIcon}
        />
        <KpiCard
          title="Interviews Today"
          value={String(interviewingSubmissions.length)}
          subtitle="in progress"
          icon={CalendarIcon}
        />
        <KpiCard
          title="Match Quality"
          value={`${avgMatchScore}%`}
          subtitle="avg score"
          icon={SparklesIcon}
        />
      </div>

      {/* Open Jobs Table */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Open Positions</h2>
        </div>
        {jobs.length === 0 ? (
          <EmptyState message="No active jobs yet. Create your first job to get started." />
        ) : (
          <DataTable
            columns={jobColumns}
            data={jobs as JobRow[]}
            keyField="id"
          />
        )}
      </div>

      {/* Bottom row */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent submissions */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Recent Submissions</h3>
          <div className="mt-4 space-y-3">
            {recentSubmissions.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No submissions yet
              </p>
            ) : (
              recentSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {sub.consultantName ?? sub.consultant?.name ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {sub.jobTitle ?? sub.job?.title ?? '—'}
                      {sub.vendorName ? ` — ${sub.vendorName}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={sub.status} />
                    <span className="text-xs text-gray-400">
                      {formatTime(sub.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Interview pipeline */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Interview Pipeline</h3>
          <div className="mt-4 space-y-3">
            {interviewingSubmissions.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No interviews scheduled
              </p>
            ) : (
              interviewingSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600">
                      {formatTime(sub.createdAt).split(' ')[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {sub.consultantName ?? sub.consultant?.name ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {sub.jobTitle ?? sub.job?.title ?? '—'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
