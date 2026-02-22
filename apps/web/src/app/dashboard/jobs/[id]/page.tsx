'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { DataTable, type Column } from '@/components/data-table';
import {
  ArrowLeftIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface Vendor {
  name: string;
  contactName: string;
  contactEmail: string;
}

interface Submission {
  id: string;
  consultant: { firstName: string; lastName: string; email: string };
  status: string;
  matchScore: number | null;
  payRate: number | null;
  billRate: number | null;
  submittedAt: string;
}

interface Job {
  id: string;
  title: string;
  description: string | null;
  vendor: Vendor | null;
  skills: string[];
  location: string | null;
  locationType: string | null;
  status: string;
  billRateMin: number | null;
  billRateMax: number | null;
  payRateMin: number | null;
  payRateMax: number | null;
  pods: unknown[];
  submissions: Submission[];
  createdAt: string;
}

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  skills: string[];
  matchScore: number;
}

type SubRow = Submission & Record<string, unknown>;

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
    </div>
  );
}

function formatRate(min: number | null, max: number | null): string {
  if (min != null && max != null) return `$${min}–$${max}/hr`;
  if (min != null) return `$${min}+/hr`;
  if (max != null) return `Up to $${max}/hr`;
  return '—';
}

export default function JobDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [candidatesFetched, setCandidatesFetched] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function fetchJob() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<Job>('/jobs/' + id);
        if (!cancelled) {
          const skills =
            typeof data.skills === 'string' ? JSON.parse(data.skills) : data.skills ?? [];
          setJob({ ...data, skills });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load job';
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchJob();
    return () => { cancelled = true; };
  }, [id]);

  const findCandidates = useCallback(async () => {
    if (!id) return;
    try {
      setCandidatesLoading(true);
      setCandidatesError(null);
      const data = await api.get<Candidate[]>('/jobs/' + id + '/candidates');
      setCandidates(data);
      setCandidatesFetched(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to find candidates';
      setCandidatesError(message);
    } finally {
      setCandidatesLoading(false);
    }
  }, [id]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-sm text-gray-500">Job not found</p>
        <Link
          href="/dashboard/jobs"
          className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          Back to Jobs
        </Link>
      </div>
    );
  }

  const submissions = job.submissions ?? [];
  const jobSkills = job.skills ?? [];

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
          <p className="font-medium text-gray-900">
            {row.consultant.firstName} {row.consultant.lastName}
          </p>
          <p className="text-xs text-gray-500">{row.consultant.email}</p>
        </div>
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
                  score >= 80
                    ? 'bg-emerald-500'
                    : score >= 60
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-700">
              {score}%
            </span>
          </div>
        );
      },
    },
    {
      key: 'payRate',
      header: 'Pay Rate',
      sortable: true,
      render: (row) => (
        <span className="font-medium">
          {row.payRate != null ? `$${row.payRate}/hr` : '—'}
        </span>
      ),
    },
    {
      key: 'billRate',
      header: 'Bill Rate',
      sortable: true,
      render: (row) => (
        <span className="font-medium">
          {row.billRate != null ? `$${row.billRate}/hr` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <>
      <Link
        href="/dashboard/jobs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back to Jobs
      </Link>

      <PageHeader
        title={job.title}
        description={`${job.vendor?.name ?? 'Unknown Vendor'} — Job ${job.id}`}
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-secondary">Edit Job</button>
            <button className="btn-primary">Add Submission</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Status + meta */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={job.status} size="md" />
              {job.locationType && (
                <StatusBadge status={job.locationType} size="md" />
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Bill Rate</p>
                  <p className="text-sm font-semibold">
                    {formatRate(job.billRateMin, job.billRateMax)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Pay Rate</p>
                  <p className="text-sm font-semibold">
                    {formatRate(job.payRateMin, job.payRateMax)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPinIcon className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Location</p>
                  <p className="text-sm font-semibold">
                    {job.location || '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="text-sm font-semibold">
                    {new Date(job.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Description</h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              {job.description || 'No description provided.'}
            </p>
            {jobSkills.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold uppercase text-gray-500">
                  Required Skills
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {jobSkills.map((s: string) => (
                    <span
                      key={s}
                      className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submissions */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Submissions ({submissions.length})
              </h2>
            </div>
            <DataTable
              columns={subColumns}
              data={submissions as unknown as SubRow[]}
              keyField="id"
              emptyMessage="No submissions yet"
            />
          </div>

          {/* AI Candidate Matching */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                AI Candidate Matching
              </h3>
              <button
                onClick={findCandidates}
                disabled={candidatesLoading}
                className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <SparklesIcon className="h-4 w-4" />
                {candidatesLoading
                  ? 'Searching…'
                  : 'Find Matching Consultants'}
              </button>
            </div>

            {candidatesError && (
              <p className="mt-4 text-sm text-red-600">{candidatesError}</p>
            )}

            {candidatesFetched && candidates.length === 0 && !candidatesError && (
              <p className="mt-4 text-sm text-gray-500">
                No matching consultants found.
              </p>
            )}

            {candidates.length > 0 && (
              <div className="mt-4 divide-y divide-gray-100">
                {candidates.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{c.email}</p>
                      {c.skills?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.skills.map((s: string) => (
                            <span
                              key={s}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                jobSkills.includes(s)
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-12 rounded-full bg-gray-200">
                        <div
                          className={`h-1.5 rounded-full ${
                            c.matchScore >= 80
                              ? 'bg-emerald-500'
                              : c.matchScore >= 60
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${c.matchScore}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700">
                        {c.matchScore}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Vendor card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Vendor</h3>
            {job.vendor ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  {job.vendor.name}
                </p>
                <p className="text-sm text-gray-600">
                  {job.vendor.contactName}
                </p>
                <a
                  href={`mailto:${job.vendor.contactEmail}`}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  {job.vendor.contactEmail}
                </a>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500">No vendor assigned</p>
            )}
          </div>

          {/* Submission stats */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">
              Submission Summary
            </h3>
            <div className="mt-4 space-y-3">
              {[
                {
                  label: 'Total',
                  count: submissions.length,
                  color: 'bg-gray-500',
                },
                {
                  label: 'Interviewing',
                  count: submissions.filter(
                    (s) => s.status === 'INTERVIEWING',
                  ).length,
                  color: 'bg-blue-500',
                },
                {
                  label: 'Submitted',
                  count: submissions.filter((s) => s.status === 'SUBMITTED')
                    .length,
                  color: 'bg-emerald-500',
                },
                {
                  label: 'Pending Consent',
                  count: submissions.filter(
                    (s) => s.status === 'CONSENT_PENDING',
                  ).length,
                  color: 'bg-amber-500',
                },
                {
                  label: 'Rejected',
                  count: submissions.filter((s) => s.status === 'REJECTED')
                    .length,
                  color: 'bg-red-500',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${stat.color}`} />
                    <span className="text-sm text-gray-600">{stat.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {stat.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Activity</h3>
            <p className="mt-4 text-sm text-gray-500">
              No activity recorded yet
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
