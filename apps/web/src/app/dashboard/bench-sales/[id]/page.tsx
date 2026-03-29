'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  ArrowPathIcon,
  ArrowLeftIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ClockIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  StarIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

/* ---------- types ---------- */

interface ResumeInfo {
  id: string;
  version: string;
  fileUrl: string;
  source: string | null;
  createdAt: string;
  isCurrent?: boolean;
}

interface WorkAuth {
  id: string;
  authType: string;
  expiryDate: string | null;
  employer: string | null;
  notes: string | null;
  isCurrent?: boolean;
  createdAt?: string;
}

interface SubmissionRecord {
  id: string;
  jobId: string;
  jobTitle: string | null;
  jobLocation: string | null;
  vendorName: string | null;
  status: string;
  submitterType: string | null;
  notes: string | null;
  createdAt: string;
}

interface ConsultantDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  skills: string[];
  pods: string[];
  readiness: string;
  verificationStatus: string;
  desiredRate: number | null;
  currentRate: number | null;
  qualityScore: number | null;
  availableFrom: string | null;
  premiumSkillFamilies: string[];
  sourcingLane: string | null;
  trustScore: number | null;
  visaBadge: string;
  currentWorkAuth: WorkAuth | null;
  workAuthHistory: WorkAuth[];
  currentResume: ResumeInfo | null;
  resumeHistory: ResumeInfo[];
  techCategories: { key: string; label: string; matchCount: number }[];
  submissions: SubmissionRecord[];
  stats: {
    totalSubmissions: number;
    activeSubmissions: number;
    totalInterviews: number;
    interviewingNow: number;
    totalOffers: number;
    totalPlacements: number;
  };
}

interface ScoreBreakdown {
  skillOverlap: number;
  rateFit: number;
  freshness: number;
  quality: number;
}

interface MatchedJob {
  id: string;
  source: 'MARKET' | 'INTERNAL';
  title: string;
  company: string;
  location: string | null;
  locationType: string | null;
  employmentType: string;
  employmentTypeBadge: string | null;
  skills: string[];
  rateMin: number | null;
  rateMax: number | null;
  rateText: string | null;
  applyUrl: string | null;
  sourceUrl: string | null;
  jobSource: string | null;
  postedAt: string | null;
  recruiterName: string | null;
  recruiterEmail: string | null;
  realnessScore: number | null;
  matchScore: number;
  scoreBreakdown: ScoreBreakdown;
}

interface TopJobsResponse {
  consultantId: string;
  consultantName: string;
  visaType: string | null;
  visaBadge: string | null;
  h1bRestricted: boolean;
  desiredRate: number | null;
  jobs: MatchedJob[];
}

/* ---------- helpers ---------- */

const READINESS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700',
  DOCS_PENDING: 'bg-amber-100 text-amber-800',
  VERIFIED: 'bg-blue-100 text-blue-800',
  SUBMISSION_READY: 'bg-emerald-100 text-emerald-800',
  ON_ASSIGNMENT: 'bg-violet-100 text-violet-800',
  OFFBOARDED: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-700',
  SHORTLISTED: 'bg-indigo-100 text-indigo-700',
  INTERVIEW: 'bg-purple-100 text-purple-700',
  OFFERED: 'bg-emerald-100 text-emerald-700',
  PLACED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-700',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
};

function formatRate(min: number | null, max: number | null, rateText: string | null): string {
  if (rateText) return rateText;
  if (!min && !max) return '—';
  if (min && max && min !== max) return `$${Math.round(min)}-$${Math.round(max)}/hr`;
  return `$${Math.round(min ?? max!)}/hr`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function matchScoreColor(score: number): string {
  if (score >= 70) return 'bg-green-100 text-green-800 ring-green-600/20';
  if (score >= 50) return 'bg-amber-100 text-amber-800 ring-amber-600/20';
  return 'bg-red-100 text-red-800 ring-red-600/20';
}

function matchScoreBg(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

/* ---------- component ---------- */

export default function ConsultantProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [consultant, setConsultant] = useState<ConsultantDetail | null>(null);
  const [topJobs, setTopJobs] = useState<TopJobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [generatingResume, setGeneratingResume] = useState<string | null>(null);
  const [previewResumeUrl, setPreviewResumeUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchConsultant = useCallback(async () => {
    try {
      const data = await api.get<ConsultantDetail>(`/bench-sales/consultants/${id}`);
      setConsultant(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load consultant');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchTopJobs = useCallback(async () => {
    try {
      const data = await api.get<TopJobsResponse>(`/bench-sales/consultants/${id}/top-jobs?limit=10`);
      setTopJobs(data);
    } catch {
      /* non-critical */
    } finally {
      setJobsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchConsultant();
    fetchTopJobs();
  }, [fetchConsultant, fetchTopJobs]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleGenerateResume = async (jobId: string, source: 'MARKET' | 'INTERNAL') => {
    setGeneratingResume(jobId);
    try {
      await api.post(`/job-match/generate-resume`, {
        consultantId: id,
        jobId,
        jobType: source === 'MARKET' ? 'market' : 'internal',
      });
      showToast('Resume generated successfully');
    } catch {
      showToast('Failed to generate resume', 'error');
    } finally {
      setGeneratingResume(null);
    }
  };

  /* -- loading -- */
  if (loading) {
    return (
      <>
        <PageHeader title="Consultant Profile" description="Loading..." />
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      </>
    );
  }

  /* -- error -- */
  if (error || !consultant) {
    return (
      <>
        <PageHeader title="Consultant Profile" description="Error" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">{error || 'Consultant not found'}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchConsultant(); }}
            className="mt-3 text-sm font-medium text-red-600 underline hover:text-red-800"
          >
            Try again
          </button>
        </div>
      </>
    );
  }

  const c = consultant;
  const consultantSkillsLower = c.skills.map((s) => s.toLowerCase());

  return (
    <>
      {/* ======== TOAST ======== */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success'
            ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* ======== PAGE HEADER ======== */}
      <div className="mb-4">
        <button
          onClick={() => router.push('/dashboard/bench-sales')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Bench Sales
        </button>
      </div>
      <PageHeader
        title={`${c.firstName} ${c.lastName}`}
        description={
          [c.techCategories?.[0]?.label, c.visaBadge].filter(Boolean).join(' · ') || undefined
        }
        actions={
          <button
            onClick={() => { setLoading(true); fetchConsultant(); fetchTopJobs(); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {/* ======== SECTION 1: CONSULTANT PROFILE ======== */}
      <div className="space-y-6">
        {/* Summary Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Name / Contact */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Contact</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  {c.firstName} {c.lastName}
                </div>
                <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                  <EnvelopeIcon className="h-4 w-4" />
                  {c.email}
                </a>
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                    <PhoneIcon className="h-4 w-4" />
                    {c.phone}
                  </a>
                )}
              </div>
            </div>

            {/* Visa / Readiness */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Status</h3>
              <div className="space-y-2">
                {c.currentWorkAuth && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <ShieldCheckIcon className="h-4 w-4 text-gray-400" />
                    <span>{c.currentWorkAuth.authType}</span>
                    <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {c.visaBadge}
                    </span>
                    {c.currentWorkAuth.expiryDate && (
                      <span className="text-xs text-gray-500">
                        exp {new Date(c.currentWorkAuth.expiryDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
                {!c.currentWorkAuth && c.visaBadge && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <ShieldCheckIcon className="h-4 w-4 text-gray-400" />
                    {c.visaBadge}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircleIcon className="h-4 w-4 text-gray-400" />
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      READINESS_COLORS[c.readiness] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {c.readiness.replace(/_/g, ' ')}
                  </span>
                </div>
                {c.qualityScore != null && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <StarIcon className="h-4 w-4 text-gray-400" />
                    Quality Score: <span className="font-semibold">{c.qualityScore}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rate / Availability */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Availability</h3>
              <div className="space-y-2">
                {c.desiredRate != null && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                    Desired Rate: <span className="font-semibold">${c.desiredRate}/hr</span>
                  </div>
                )}
                {c.availableFrom && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <ClockIcon className="h-4 w-4 text-gray-400" />
                    Available from: <span className="font-semibold">{new Date(c.availableFrom).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Skills */}
        {c.skills.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {c.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Work Auth Info */}
        {c.workAuthHistory && c.workAuthHistory.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">Work Authorization</h3>
            <div className="space-y-2">
              {c.workAuthHistory.map((wa) => (
                <div key={wa.id} className="flex items-center gap-3 text-sm text-gray-700">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    wa.isCurrent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {wa.authType}
                  </span>
                  {wa.employer && <span className="text-gray-600">({wa.employer})</span>}
                  {wa.expiryDate && <span className="text-gray-500">Exp: {new Date(wa.expiryDate).toLocaleDateString()}</span>}
                  {wa.isCurrent && <span className="text-xs text-green-600 font-medium">Current</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resume */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">Resume</h3>
          {c.currentResume ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <DocumentTextIcon className="h-8 w-8 text-indigo-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {c.currentResume.version || 'Current Resume'}
                    {c.currentResume.source && (
                      <span className="ml-2 text-xs text-gray-400">
                        ({c.currentResume.source === 'baseline-generated' ? 'Auto-generated' : c.currentResume.source})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    Uploaded {new Date(c.currentResume.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => setPreviewResumeUrl(
                    previewResumeUrl === c.currentResume!.fileUrl ? null : c.currentResume!.fileUrl,
                  )}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
                >
                  <DocumentTextIcon className="h-4 w-4" />
                  {previewResumeUrl === c.currentResume.fileUrl ? 'Hide Resume' : 'View Resume'}
                </button>
              </div>

              {/* Inline resume preview */}
              {previewResumeUrl && (
                <div className="mt-3 rounded-lg border border-gray-200 overflow-hidden bg-white">
                  {previewResumeUrl.startsWith('http://') || previewResumeUrl.startsWith('https://') || previewResumeUrl.startsWith('data:') ? (
                    <iframe
                      src={previewResumeUrl}
                      className="w-full border-0"
                      style={{ height: '600px' }}
                      title="Resume Preview"
                    />
                  ) : previewResumeUrl.startsWith('s3://') ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                      <DocumentTextIcon className="h-16 w-16 text-gray-300 mb-4" />
                      <p className="text-sm font-medium text-gray-700">
                        {c.currentResume!.version || 'Resume'} (Seed Data)
                      </p>
                      <p className="mt-3 text-xs text-gray-400">
                        This is placeholder seed data. Upload a real resume to replace it.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                      <DocumentTextIcon className="h-16 w-16 text-gray-300 mb-4" />
                      <p className="text-sm font-medium text-gray-700">
                        {c.currentResume!.version || 'Resume'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 font-mono">{previewResumeUrl.split('/').pop()}</p>
                    </div>
                  )}
                </div>
              )}

              {c.resumeHistory.length > 1 && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs font-medium text-gray-500 mb-1">Previous Versions</p>
                  {c.resumeHistory.filter((r) => r.id !== c.currentResume!.id).slice(0, 3).map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-xs text-gray-500 py-0.5">
                      <DocumentTextIcon className="h-3.5 w-3.5 text-gray-400" />
                      <span>{r.version}</span>
                      <span>·</span>
                      <button
                        onClick={() => setPreviewResumeUrl(previewResumeUrl === r.fileUrl ? null : r.fileUrl)}
                        className="text-indigo-600 hover:underline"
                      >
                        View
                      </button>
                      <span className="text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No resume uploaded</p>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Total Submissions" value={c.stats.totalSubmissions} />
          <StatCard label="Active Submissions" value={c.stats.activeSubmissions} accent />
          <StatCard label="Interviews" value={c.stats.totalInterviews} />
          <StatCard label="Placements" value={c.stats.totalPlacements} accent />
          <StatCard label="Offers" value={c.stats.totalOffers} />
        </div>

        {/* Recent Submissions Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Recent Submissions</h3>
          </div>
          {c.submissions && c.submissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Job Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {c.submissions.slice(0, 20).map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{sub.jobTitle ?? '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{sub.vendorName ?? '—'}</td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            STATUS_COLORS[sub.status] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {sub.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BriefcaseIcon className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No submissions yet</p>
            </div>
          )}
        </div>

        {/* ======== SECTION 2: TOP JOB MATCHES ======== */}
        <div className="pt-4">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Top Job Matches</h2>
            {topJobs && (
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                {topJobs.jobs.length}
              </span>
            )}
          </div>

          {/* H1B Warning */}
          {topJobs?.h1bRestricted && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-sm font-medium text-amber-800">
                H1B visa — only C2C jobs shown
              </p>
            </div>
          )}

          {jobsLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
          ) : !topJobs || topJobs.jobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <BriefcaseIcon className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-400">No matching jobs found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topJobs.jobs.map((job) => {
                const isExpanded = expandedJob === job.id;
                const jobSkillsLower = job.skills.map((s) => s.toLowerCase());

                return (
                  <div
                    key={job.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          {/* Match Score Badge */}
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${matchScoreColor(job.matchScore)}`}
                          >
                            <SparklesIcon className="mr-1 h-3.5 w-3.5" />
                            {job.matchScore}%
                          </span>
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {job.title}
                          </h3>
                          {/* Employment type badge */}
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 ring-1 ring-inset ring-gray-200">
                            {job.employmentTypeBadge || job.employmentType}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-600">{job.company}</p>

                        {/* Location + rate + posted */}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPinIcon className="h-3.5 w-3.5" />
                              {job.location}
                              {job.locationType && (
                                <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                                  {job.locationType}
                                </span>
                              )}
                            </span>
                          )}
                          {(job.rateMin || job.rateMax || job.rateText) && (
                            <span className="flex items-center gap-1">
                              <CurrencyDollarIcon className="h-3.5 w-3.5" />
                              {formatRate(job.rateMin, job.rateMax, job.rateText)}
                            </span>
                          )}
                          {job.postedAt && (
                            <span className="flex items-center gap-1">
                              <ClockIcon className="h-3.5 w-3.5" />
                              {timeAgo(job.postedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right side: source badge */}
                      <div className="shrink-0 text-right space-y-1.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            job.source === 'MARKET'
                              ? 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200'
                              : 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                          }`}
                        >
                          {job.source}
                        </span>
                        {job.realnessScore != null && (
                          <div className={`flex items-center justify-end gap-0.5 text-[10px] font-bold ${
                            job.realnessScore >= 70 ? 'text-emerald-600'
                            : job.realnessScore >= 50 ? 'text-amber-600'
                            : 'text-red-500'
                          }`}>
                            <ShieldCheckIcon className="h-3.5 w-3.5" />
                            {job.realnessScore}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Skills row */}
                    {job.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {job.skills.map((skill) => {
                          const isMatched = consultantSkillsLower.includes(skill.toLowerCase());
                          return (
                            <span
                              key={skill}
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                isMatched
                                  ? 'bg-green-100 text-green-800 ring-1 ring-inset ring-green-300'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {isMatched && <CheckCircleIcon className="mr-0.5 h-3 w-3" />}
                              {skill}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Score Breakdown (expandable) */}
                    <div className="mt-3">
                      <button
                        onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDownIcon className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRightIcon className="h-3.5 w-3.5" />
                        )}
                        Score Breakdown
                      </button>

                      {isExpanded && (
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <BreakdownBar label="Skill Overlap" value={job.scoreBreakdown.skillOverlap} />
                          <BreakdownBar label="Rate Fit" value={job.scoreBreakdown.rateFit} />
                          <BreakdownBar label="Freshness" value={job.scoreBreakdown.freshness} />
                          <BreakdownBar label="Quality" value={job.scoreBreakdown.quality} />
                        </div>
                      )}
                    </div>

                    {/* Recruiter Contact */}
                    {(job.recruiterName || job.recruiterEmail) && (
                      <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-700">
                          {job.recruiterName && (
                            <span className="flex items-center gap-1">
                              <UserIcon className="h-3.5 w-3.5 text-indigo-500" />
                              {job.recruiterName}
                            </span>
                          )}
                          {job.recruiterEmail && (
                            <a
                              href={`mailto:${job.recruiterEmail}`}
                              className="flex items-center gap-1 text-indigo-600 hover:underline"
                            >
                              <EnvelopeIcon className="h-3.5 w-3.5" />
                              {job.recruiterEmail}
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => handleGenerateResume(job.id, job.source)}
                        disabled={generatingResume === job.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {generatingResume === job.id ? (
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <DocumentTextIcon className="h-4 w-4" />
                        )}
                        {generatingResume === job.id ? 'Generating...' : 'Generate Resume'}
                      </button>
                      {job.source === 'MARKET' && (
                        <button
                          onClick={() => router.push(`/dashboard/market-jobs/match/${job.id}`)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                        >
                          <BriefcaseIcon className="h-4 w-4" />
                          View Job
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- sub-components ---------- */

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${accent ? 'text-indigo-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 70 ? 'bg-green-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-gray-500">{label}</span>
        <span className="text-[10px] font-bold text-gray-700">{value}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}
