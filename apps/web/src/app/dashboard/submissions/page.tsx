'use client';

import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import {
  DocumentPlusIcon,
  ArrowPathIcon,
  BriefcaseIcon,
  CurrencyDollarIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

interface Submission {
  id: string;
  consultant: { firstName: string; lastName: string; email: string };
  jobReq: { id: string; title: string; vendor: { name: string } };
  status: string;
  matchScore: number | null;
  payRate: number | null;
  billRate: number | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const PIPELINE_STAGES = [
  { key: 'CONSENT_PENDING', label: 'Pending Consent', color: 'bg-amber-400', ring: 'ring-amber-200', bg: 'bg-amber-50' },
  { key: 'SUBMITTED', label: 'Submitted', color: 'bg-blue-500', ring: 'ring-blue-200', bg: 'bg-blue-50' },
  { key: 'INTERVIEWING', label: 'Interviewing', color: 'bg-indigo-500', ring: 'ring-indigo-200', bg: 'bg-indigo-50' },
  { key: 'OFFERED', label: 'Offered', color: 'bg-violet-500', ring: 'ring-violet-200', bg: 'bg-violet-50' },
  { key: 'ACCEPTED', label: 'Accepted', color: 'bg-emerald-500', ring: 'ring-emerald-200', bg: 'bg-emerald-50' },
] as const;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MatchBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-gray-400">N/A</span>;
  const barColor = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-10 rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700">{score}%</span>
    </div>
  );
}

function SubmissionCard({ submission }: { submission: Submission }) {
  const { consultant, jobReq, matchScore, payRate, billRate, submittedAt } = submission;
  const name = `${consultant.firstName} ${consultant.lastName}`;
  const margin = payRate != null && billRate != null ? billRate - payRate : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>

      <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-600">
        <BriefcaseIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="truncate">{jobReq.title}</span>
      </div>
      <p className="mt-0.5 pl-5 text-xs text-gray-400 truncate">{jobReq.vendor?.name ?? '—'}</p>

      <div className="mt-3 flex items-center justify-between">
        <MatchBar score={matchScore} />
        <div className="flex items-center gap-0.5 text-xs text-gray-500">
          <CalendarIcon className="h-3.5 w-3.5" />
          <span>{formatDate(submittedAt)}</span>
        </div>
      </div>

      {(payRate != null || billRate != null) && (
        <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2 text-xs">
          <CurrencyDollarIcon className="h-3.5 w-3.5 text-gray-400" />
          {payRate != null && <span className="text-gray-600">Pay ${payRate}/hr</span>}
          {billRate != null && <span className="text-gray-600">Bill ${billRate}/hr</span>}
          {margin != null && (
            <span className={`ml-auto font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {margin >= 0 ? '+' : ''}${margin}/hr
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
      <p className="mt-3 text-sm text-gray-500">Loading submissions…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-24">
      <BriefcaseIcon className="h-10 w-10 text-gray-300" />
      <p className="mt-3 text-sm font-medium text-gray-600">No submissions yet</p>
      <p className="mt-1 text-xs text-gray-400">Create your first submission to see it here.</p>
    </div>
  );
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<Submission[]>('/submissions');
        if (!cancelled) setSubmissions(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load submissions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader
          title="Submissions"
          description="Track and manage all candidate submissions across jobs"
        />
        <LoadingSpinner />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader
          title="Submissions"
          description="Track and manage all candidate submissions across jobs"
        />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); }}
            className="mt-3 text-sm font-medium text-red-600 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      </>
    );
  }

  if (submissions.length === 0) {
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
        <EmptyState />
      </>
    );
  }

  const grouped = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    items: submissions.filter((s) => s.status === stage.key),
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

      <div className="flex gap-4 overflow-x-auto pb-4">
        {grouped.map((stage) => (
          <div key={stage.key} className="flex w-72 shrink-0 flex-col">
            <div className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 ${stage.bg}`}>
              <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
              <span className="text-sm font-semibold text-gray-700">{stage.label}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${stage.ring} text-gray-600 bg-white`}>
                {stage.items.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2.5 rounded-xl border border-gray-100 bg-gray-50/50 p-2.5 min-h-[120px]">
              {stage.items.length === 0 && (
                <p className="py-6 text-center text-xs text-gray-400">No submissions</p>
              )}
              {stage.items.map((sub) => (
                <SubmissionCard key={sub.id} submission={sub} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
