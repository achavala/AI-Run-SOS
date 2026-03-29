'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { ClickableMetric, StaticDrillDownModal } from '@/components/drill-down-modal';
import {
  ArrowTopRightOnSquareIcon,
  ArrowLeftIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ClockIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserIcon,
  ShieldCheckIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

/* ── Types ─────────────────────────────────────────────────────── */

interface MarketJob {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string | null;
  locationType: string;
  employmentType: string;
  rateMin: number | null;
  rateMax: number | null;
  rateText: string | null;
  skills: string[];
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  applyUrl: string | null;
  source: string;
  postedAt: string | null;
  recruiterName: string | null;
  recruiterEmail: string | null;
  recruiterPhone: string | null;
  realnessScore: number | null;
  actionabilityScore: number | null;
}

interface ScoreBreakdown {
  mustHaveSkills: number;
  niceToHaveSkills: number;
  yearsExperience: number;
  domainRelevance: number;
  toolsPlatformFit: number;
  projectRelevance: number;
  locationFit: number;
  visaEligibility: number;
  rateAttractiveness: number;
}

interface WorkAuth {
  authType: string;
  expiryDate: string | null;
}

interface MatchedConsultant {
  consultantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  skills: string[];
  desiredRate: number | null;
  readiness: string | null;
  pods: string[];
  premiumSkillFamilies: string[];
  workAuths: WorkAuth[];
  overallScore: number;
  scoreBreakdown: ScoreBreakdown;
  matchReasons: string[];
  gaps: string[];
  visaEligible: boolean;
  visaNote: string | null;
  submissionReady: boolean;
}

interface MatchResponse {
  job: MarketJob;
  matches: MatchedConsultant[];
}

interface ResumeResult {
  matchScore: number;
  submissionReady: boolean;
}

interface SubmissionResult {
  status: 'ready' | 'approval_required';
  message: string;
}

/* ── Constants ─────────────────────────────────────────────────── */

const TYPE_COLORS: Record<string, string> = {
  C2C: 'bg-purple-100 text-purple-700 ring-purple-600/20',
  W2: 'bg-blue-100 text-blue-700 ring-blue-600/20',
  CONTRACT: 'bg-amber-100 text-amber-700 ring-amber-600/20',
  FULLTIME: 'bg-green-100 text-green-700 ring-green-600/20',
};

const TYPE_LABELS: Record<string, string> = {
  C2C: 'C2C',
  W2: 'W2',
  CONTRACT: 'Contract',
  FULLTIME: 'Full-time',
};

const SOURCE_LABELS: Record<string, string> = {
  JSEARCH: 'Google Jobs',
  JOOBLE: 'Jooble',
  ADZUNA: 'Adzuna',
  ARBEITNOW: 'Arbeitnow',
  CAREERJET: 'Careerjet',
  DICE: 'Dice',
  LINKEDIN: 'LinkedIn',
  INDEED: 'Indeed',
  ZIPRECRUITER: 'ZipRecruiter',
  OTHER: 'Other',
};

const SCORE_WEIGHTS: Record<keyof ScoreBreakdown, { label: string; weight: string }> = {
  mustHaveSkills: { label: 'Must-Have Skills', weight: '30%' },
  niceToHaveSkills: { label: 'Nice-to-Have Skills', weight: '15%' },
  yearsExperience: { label: 'Years of Experience', weight: '10%' },
  domainRelevance: { label: 'Domain Relevance', weight: '10%' },
  toolsPlatformFit: { label: 'Tools / Platform Fit', weight: '10%' },
  projectRelevance: { label: 'Project Relevance', weight: '10%' },
  locationFit: { label: 'Location Fit', weight: '5%' },
  visaEligibility: { label: 'Visa Eligibility', weight: '5%' },
  rateAttractiveness: { label: 'Rate Attractiveness', weight: '5%' },
};

/* ── Helpers ───────────────────────────────────────────────────── */

function formatRate(min: number | null, max: number | null, rateText?: string | null): string {
  if (rateText) return rateText;
  if (!min && !max) return '--';
  if (min && max && min !== max) return `$${Math.round(min)}-$${Math.round(max)}/hr`;
  return `$${Math.round(min ?? max!)}/hr`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-green-700 bg-green-100 ring-green-600/20';
  if (score >= 70) return 'text-amber-700 bg-amber-100 ring-amber-600/20';
  return 'text-red-700 bg-red-100 ring-red-600/20';
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Submission Ready';
  if (score >= 70) return 'Good Match';
  return 'Weak Match';
}

function barColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-400';
}

/* ── Main Page ─────────────────────────────────────────────────── */

export default function JobMatchPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<MatchResponse>(`/job-match/for-job?marketJobId=${id}&limit=20`)
      .then(setData)
      .catch((err) => setError(err.message ?? 'Failed to load match data'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <>
        <PageHeader title="Job Match" description="Loading match data..." />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Job Match" description="Error loading match data" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-2 text-sm text-red-700">{error ?? 'No data returned'}</p>
        </div>
      </>
    );
  }

  const { job, matches } = data;

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Back button */}
      <div className="mb-4">
        <button
          onClick={() => router.push('/dashboard/market-jobs')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Market Jobs
        </button>
      </div>

      <PageHeader
        title={job.title}
        description={`${job.company} · ${SOURCE_LABELS[job.source] ?? job.source}`}
      />

      {/* ── Section 1: Job Details ──────────────────────────── */}
      <div className="space-y-6">
        {/* Info Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Employment type badge */}
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                TYPE_COLORS[job.employmentType] ?? 'bg-gray-100 text-gray-600 ring-gray-400/20'
              }`}
            >
              {TYPE_LABELS[job.employmentType] ?? job.employmentType}
            </span>

            {/* Location + type */}
            {job.location && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                <MapPinIcon className="h-4 w-4 text-gray-400" />
                {job.location}
                {job.locationType && (
                  <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    {job.locationType}
                  </span>
                )}
              </span>
            )}

            {/* Rate range */}
            {(job.rateMin || job.rateMax || job.rateText) && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                {formatRate(job.rateMin, job.rateMax, job.rateText)}
              </span>
            )}

            {/* Posted date */}
            <span className="inline-flex items-center gap-1 text-sm text-gray-600">
              <ClockIcon className="h-4 w-4 text-gray-400" />
              {formatDate(job.postedAt)}
            </span>

            {/* Source */}
            <span className="text-xs text-gray-400">
              {SOURCE_LABELS[job.source] ?? job.source}
            </span>

            {/* Realness score */}
            {job.realnessScore !== null && (
              <ClickableMetric metric="realnessScore" title="Realness Score Details">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <ShieldCheckIcon className="h-4 w-4" />
                  Realness {job.realnessScore}
                </span>
              </ClickableMetric>
            )}

            {/* Actionability score */}
            {job.actionabilityScore !== null && (
              <ClickableMetric metric="actionabilityScore" title="Actionability Score Details">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600">
                  <CheckBadgeIcon className="h-4 w-4" />
                  Actionability {job.actionabilityScore}
                </span>
              </ClickableMetric>
            )}
          </div>
        </div>

        {/* Full Job Description */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Job Description</h2>
          <div className="max-h-72 overflow-y-auto rounded-lg bg-gray-50 p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {job.description}
          </div>
        </div>

        {/* Skills */}
        {job.skills && job.skills.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                >
                  {skill}
                </span>
              ))}
            </div>
            {job.mustHaveSkills && job.mustHaveSkills.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Must-Have</p>
                <div className="flex flex-wrap gap-1.5">
                  {job.mustHaveSkills.map((s) => (
                    <span key={s} className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {job.niceToHaveSkills && job.niceToHaveSkills.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Nice-to-Have</p>
                <div className="flex flex-wrap gap-1.5">
                  {job.niceToHaveSkills.map((s) => (
                    <span key={s} className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recruiter Contact */}
        {(job.recruiterName || job.recruiterEmail || job.recruiterPhone) && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-6 shadow-sm">
            <h2 className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-3">Recruiter Contact</h2>
            <div className="space-y-2">
              {job.recruiterName && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <UserIcon className="h-4 w-4 text-indigo-500" />
                  {job.recruiterName}
                </div>
              )}
              {job.recruiterEmail && (
                <a
                  href={`mailto:${job.recruiterEmail}`}
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                >
                  <EnvelopeIcon className="h-4 w-4" />
                  {job.recruiterEmail}
                </a>
              )}
              {job.recruiterPhone && (
                <a
                  href={`tel:${job.recruiterPhone}`}
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                >
                  <PhoneIcon className="h-4 w-4" />
                  {job.recruiterPhone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Apply URL */}
        {job.applyUrl && (
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            Open Apply URL
          </a>
        )}
      </div>

      {/* ── Section 2: Top Matching Consultants ─────────────── */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-indigo-500" />
          Top Matching Consultants
          <ClickableMetric metric="matchQuality" title="Match Quality Details" staticData={{ title: 'All Matched Consultants', rows: matches }}>
            <span className="ml-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              {matches.length}
            </span>
          </ClickableMetric>
        </h2>

        {matches.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
            <p className="text-sm text-gray-400">No matching consultants found for this job.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {matches.map((match) => (
              <ConsultantCard key={match.consultantId} match={match} jobId={id} job={job} onToast={showToast} onSelect={() => setSelectedRow(match)} />
            ))}
          </div>
        )}
      </div>

      {selectedRow && (
        <StaticDrillDownModal
          title={`${selectedRow.firstName || ''} ${selectedRow.lastName || ''}`.trim() || 'Details'}
          rows={[selectedRow]}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </>
  );
}

/* ── Consultant Card ───────────────────────────────────────────── */

function ConsultantCard({
  match,
  jobId,
  job,
  onToast,
  onSelect,
}: {
  match: MatchedConsultant;
  jobId: string;
  job: MarketJob;
  onToast: (message: string, type: 'success' | 'error') => void;
  onSelect?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeResult, setResumeResult] = useState<ResumeResult | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmissionResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const matchedSkillsSet = new Set(
    (job.mustHaveSkills ?? [])
      .concat(job.niceToHaveSkills ?? [])
      .concat(job.skills ?? [])
      .map((s) => s.toLowerCase()),
  );

  const handleGenerateResume = async () => {
    setResumeLoading(true);
    setActionError(null);
    try {
      const result = await api.post<ResumeResult>('/job-match/generate-resume', {
        consultantId: match.consultantId,
        jobId: jobId,
        jobType: 'market',
      });
      setResumeResult(result);
      onToast('Resume generated successfully', 'success');
    } catch (err: unknown) {
      setActionError((err as Error).message ?? 'Resume generation failed');
      onToast('Resume generation failed', 'error');
    } finally {
      setResumeLoading(false);
    }
  };

  const handleInitiateSubmission = async () => {
    setSubmitLoading(true);
    setActionError(null);
    try {
      const result = await api.post<SubmissionResult>('/job-match/submit', {
        consultantId: match.consultantId,
        jobId: jobId,
        jobType: 'market',
      });
      setSubmitResult(result);
      onToast(result.status === 'ready' ? 'Submission successful' : 'Approval request sent', 'success');
    } catch (err: unknown) {
      setActionError((err as Error).message ?? 'Submission initiation failed');
      onToast('Submission failed', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div onClick={onSelect} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all">
      <div className="flex items-start gap-4">
        {/* Overall Score Badge */}
        <div
          className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl text-center ring-1 ring-inset ${scoreColor(
            match.overallScore,
          )}`}
        >
          <span className="text-xl font-bold leading-none">{match.overallScore}</span>
          <span className="mt-0.5 text-[9px] font-semibold leading-tight">{scoreLabel(match.overallScore)}</span>
        </div>

        {/* Main Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900">
              {match.firstName} {match.lastName}
            </h3>
            {match.submissionReady && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
                <CheckCircleIcon className="h-3 w-3" /> Submission Ready
              </span>
            )}
            {match.readiness && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                {match.readiness}
              </span>
            )}
          </div>

          {/* Contact */}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {match.email && (
              <a href={`mailto:${match.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-indigo-600 hover:underline">
                <EnvelopeIcon className="h-3.5 w-3.5" />
                {match.email}
              </a>
            )}
            {match.phone && (
              <a href={`tel:${match.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-indigo-600 hover:underline">
                <PhoneIcon className="h-3.5 w-3.5" />
                {match.phone}
              </a>
            )}
          </div>

          {/* Visa Info */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {match.visaEligible ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                <CheckCircleIcon className="h-3 w-3" /> Visa Eligible
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                <XCircleIcon className="h-3 w-3" /> Not Visa Eligible
              </span>
            )}
            {match.visaNote && (
              <span className="text-[10px] text-gray-400">{match.visaNote}</span>
            )}
            {match.workAuths && match.workAuths.length > 0 && (
              <div className="flex gap-1">
                {match.workAuths.map((wa, i) => (
                  <span
                    key={i}
                    className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                  >
                    {wa.authType}
                    {wa.expiryDate && ` (exp ${new Date(wa.expiryDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Skills: matched vs gaps */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {match.skills?.map((skill) => {
              const isMatched = matchedSkillsSet.has(skill.toLowerCase());
              return (
                <span
                  key={skill}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    isMatched
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {skill}
                </span>
              );
            })}
          </div>

          {/* Gaps */}
          {match.gaps && match.gaps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-medium text-red-500 uppercase tracking-wider mr-1">Gaps:</span>
              {match.gaps.map((gap) => (
                <span
                  key={gap}
                  className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                >
                  {gap}
                </span>
              ))}
            </div>
          )}

          {/* Desired Rate */}
          {match.desiredRate !== null && match.desiredRate !== undefined && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
              <CurrencyDollarIcon className="h-3.5 w-3.5" />
              Desired rate: ${match.desiredRate}/hr
            </div>
          )}

          {/* Score Breakdown (expandable) */}
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 transition"
          >
            {expanded ? (
              <ChevronDownIcon className="h-3.5 w-3.5" />
            ) : (
              <ChevronRightIcon className="h-3.5 w-3.5" />
            )}
            Score Breakdown
          </button>

          {expanded && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="space-y-2.5">
                {(Object.keys(SCORE_WEIGHTS) as Array<keyof ScoreBreakdown>).map((key) => {
                  const value = match.scoreBreakdown[key] ?? 0;
                  const meta = SCORE_WEIGHTS[key];
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 font-medium">{meta.label}</span>
                        <span className="text-gray-500">
                          <span className="font-semibold text-gray-800">{value}</span>/100
                          <span className="ml-1.5 text-gray-400">({meta.weight})</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor(value)}`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Match Reasons */}
          {match.matchReasons && match.matchReasons.length > 0 && (
            <div className="mt-2 text-[10px] text-gray-400">
              {match.matchReasons.join(' · ')}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleGenerateResume(); }}
              disabled={resumeLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              <DocumentTextIcon className="h-3.5 w-3.5" />
              {resumeLoading ? 'Generating...' : 'Generate Resume'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleInitiateSubmission(); }}
              disabled={submitLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm hover:bg-indigo-50 disabled:opacity-50 transition"
            >
              <PaperAirplaneIcon className="h-3.5 w-3.5" />
              {submitLoading ? 'Initiating...' : 'Initiate Submission'}
            </button>
          </div>

          {/* Action Results */}
          {actionError && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              {actionError}
            </div>
          )}

          {resumeResult && (
            <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-2.5">
              <p className="text-xs font-medium text-green-800">
                Resume generated — Match Score: {resumeResult.matchScore}
              </p>
              <p className="text-[10px] text-green-600">
                {resumeResult.submissionReady
                  ? 'Ready for submission'
                  : 'Needs review before submission'}
              </p>
            </div>
          )}

          {submitResult && (
            <div
              className={`mt-2 rounded-lg border p-2.5 ${
                submitResult.status === 'ready'
                  ? 'border-green-200 bg-green-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <p
                className={`text-xs font-medium ${
                  submitResult.status === 'ready' ? 'text-green-800' : 'text-amber-800'
                }`}
              >
                {submitResult.status === 'ready' ? 'Submission Ready' : 'Approval Required'}
              </p>
              <p
                className={`text-[10px] ${
                  submitResult.status === 'ready' ? 'text-green-600' : 'text-amber-600'
                }`}
              >
                {submitResult.message}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
