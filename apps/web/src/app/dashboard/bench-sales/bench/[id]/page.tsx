'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  SparklesIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  ChatBubbleLeftRightIcon,
  BriefcaseIcon,
  PresentationChartBarIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  ClockIcon,
  FolderIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TagIcon,
  ShieldCheckIcon,
  PlayIcon,
  PencilIcon,
  PlusIcon,
  XMarkIcon,
  CloudArrowUpIcon,
  ArrowDownTrayIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { ClickableMetric, StaticDrillDownModal } from '@/components/drill-down-modal';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AiOutput {
  id: string;
  step: string;
  status: string;
  output: Record<string, unknown>;
  htmlContent: string | null;
  tokensUsed: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface AiRun {
  id: string;
  status: string;
  currentStep: string | null;
  stepsCompleted: number;
  totalSteps: number;
  readinessScore: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  outputs: AiOutput[];
}

interface ConsultantDoc {
  id: string;
  docType: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  createdAt: string;
}

interface Activity {
  id: string;
  activityType: string;
  title: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface ResumeVersion {
  id: string;
  version: string;
  fileUrl: string;
  source: string;
  isCurrent: boolean;
  createdAt: string;
}

interface BenchConsultantDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  skills: string[];
  desiredRate: number | null;
  availableFrom: string | null;
  benchStatus: string;
  readinessScore: number | null;
  visaType: string | null;
  qualityScore: number | null;
  readiness: string;
  createdAt: string;
  latestAiRun: AiRun | null;
  documents: ConsultantDoc[];
  resumeVersions: ResumeVersion[];
  activities: Activity[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BENCH_STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700',
  IN_PREPARATION: 'bg-amber-100 text-amber-800',
  READY_TO_MARKET: 'bg-emerald-100 text-emerald-800',
  NEEDS_INFO: 'bg-red-100 text-red-700',
  MARKETED: 'bg-blue-100 text-blue-800',
};

const AI_STEP_CONFIG: Record<string, { label: string; icon: typeof SparklesIcon }> = {
  RESUME_PARSING: { label: 'Resume Parsing', icon: DocumentTextIcon },
  RESUME_PREP: { label: 'AI Enhanced Resume', icon: SparklesIcon },
  TECH_PREP: { label: 'Tech Prep', icon: AcademicCapIcon },
  COACHING: { label: 'Coaching', icon: ChatBubbleLeftRightIcon },
  LINKEDIN_PREP: { label: 'LinkedIn Prep', icon: UserIcon },
  SALES_STRATEGY: { label: 'Sales Strategy', icon: PresentationChartBarIcon },
  JOB_SEARCH: { label: 'Job Search', icon: MagnifyingGlassIcon },
  GM_STRATEGIST: { label: 'GM Assessment', icon: ChartBarIcon },
};

const ALL_STEPS = [
  'RESUME_PARSING', 'RESUME_PREP', 'TECH_PREP', 'COACHING',
  'LINKEDIN_PREP', 'SALES_STRATEGY', 'JOB_SEARCH', 'GM_STRATEGIST',
];

const AI_OUTPUT_STYLES = `
.ai-content .ai-output { font-family: system-ui, sans-serif; }
.ai-content h3 { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin-bottom: 1rem; }
.ai-content h4 { font-size: 0.95rem; font-weight: 600; color: #334155; margin: 1.25rem 0 0.5rem; }
.ai-content h5 { font-size: 0.85rem; font-weight: 600; color: #475569; margin: 0.75rem 0 0.25rem; }
.ai-content .section { margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px solid #f1f5f9; }
.ai-content .section:last-child { border-bottom: none; }
.ai-content .skill-tag, .ai-content .skill-pill, .ai-content .keyword-tag, .ai-content .industry-tag {
  display: inline-block; padding: 2px 10px; margin: 2px 4px 2px 0; border-radius: 9999px;
  font-size: 0.75rem; font-weight: 500; background: #e0e7ff; color: #3730a3;
}
.ai-content .priority-high { color: #dc2626; font-weight: 700; }
.ai-content .priority-medium { color: #d97706; font-weight: 600; }
.ai-content .priority-low { color: #16a34a; font-weight: 500; }
.ai-content table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.ai-content th { text-align: left; padding: 8px 12px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-weight: 600; color: #475569; }
.ai-content td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
.ai-content blockquote { border-left: 3px solid #6366f1; padding-left: 1rem; margin: 0.75rem 0; color: #475569; font-style: italic; }
.ai-content .coaching-tip { background: #f8fafc; border-radius: 0.5rem; padding: 0.75rem 1rem; margin-bottom: 0.5rem; }
.ai-content .objection { background: #fffbeb; border-radius: 0.5rem; padding: 0.75rem 1rem; margin-bottom: 0.5rem; border-left: 3px solid #f59e0b; }
.ai-content .score-hero { text-align: center; padding: 1.5rem; }
.ai-content .score-circle { display: inline-block; }
.ai-content .score-value { font-size: 3rem; font-weight: 800; color: #4f46e5; }
.ai-content .score-label { font-size: 1.25rem; color: #94a3b8; }
.ai-content .score-status { font-size: 1rem; font-weight: 600; color: #475569; margin-top: 0.5rem; }
.ai-content .resume-header { text-align: center; margin-bottom: 1rem; }
.ai-content .resume-header h2 { font-size: 1.5rem; color: #1e293b; }
.ai-content .resume-header .subtitle { color: #6366f1; font-weight: 500; }
.ai-content .score-bar { position: relative; height: 1.5rem; background: #e2e8f0; border-radius: 0.5rem; overflow: hidden; }
.ai-content .score-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 0.5rem; }
.ai-content .score-bar span { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-weight: 700; font-size: 0.75rem; }
.ai-content .work-entry { margin-bottom: 0.75rem; }
.ai-content .study-plan .week { padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; }
.ai-content .positioning { font-size: 1rem; color: #1e293b; font-weight: 500; line-height: 1.6; }
.ai-content .linkedin-headline { font-size: 1.1rem; color: #0369a1; font-weight: 600; }
.ai-content .assessment { font-size: 0.95rem; color: #1e293b; font-weight: 500; background: #f0fdf4; padding: 0.75rem; border-radius: 0.5rem; }
`;

type TabKey =
  | 'overview'
  | 'RESUME_PARSING'
  | 'RESUME_PREP'
  | 'TECH_PREP'
  | 'COACHING'
  | 'LINKEDIN_PREP'
  | 'SALES_STRATEGY'
  | 'JOB_SEARCH'
  | 'GM_STRATEGIST'
  | 'documents'
  | 'timeline';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function scoreColor(score: number | null): string {
  if (score === null) return 'bg-gray-200';
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function scoreTextColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function stepStatusIcon(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircleIcon className="h-4 w-4 text-emerald-500" />;
    case 'PROCESSING':
      return <ArrowPathIcon className="h-4 w-4 animate-spin text-amber-500" />;
    case 'FAILED':
      return <ExclamationCircleIcon className="h-4 w-4 text-red-500" />;
    default:
      return <ClockIcon className="h-4 w-4 text-gray-300" />;
  }
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function BenchConsultantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [consultant, setConsultant] = useState<BenchConsultantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [triggeringAi, setTriggeringAi] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  const fetchConsultant = useCallback(async () => {
    try {
      const raw = await api.get<any>(`/bench-intake/consultant/${id}`);
      // Map raw Prisma response to our interface
      const latestRun = raw.aiRuns?.[0] ?? null;
      const mapped: BenchConsultantDetail = {
        id: raw.id,
        firstName: raw.firstName,
        lastName: raw.lastName,
        email: raw.email,
        phone: raw.phone,
        skills: Array.isArray(raw.skills) ? raw.skills : [],
        desiredRate: raw.desiredRate,
        availableFrom: raw.availableFrom,
        benchStatus: raw.benchStatus ?? 'NEW',
        readinessScore: raw.readinessScore,
        visaType: raw.workAuths?.[0]?.authType ?? null,
        qualityScore: raw.qualityScore,
        readiness: raw.readiness,
        createdAt: raw.createdAt,
        latestAiRun: latestRun
          ? {
              id: latestRun.id,
              status: latestRun.status,
              currentStep: latestRun.currentStep,
              stepsCompleted: latestRun.stepsCompleted,
              totalSteps: latestRun.totalSteps,
              readinessScore: latestRun.readinessScore,
              errorMessage: latestRun.errorMessage,
              startedAt: latestRun.startedAt,
              completedAt: latestRun.completedAt,
              outputs: (latestRun.outputs ?? []).map((o: any) => ({
                id: o.id,
                step: o.step,
                status: o.status,
                output: o.output ?? {},
                htmlContent: o.htmlContent,
                tokensUsed: o.tokensUsed,
                durationMs: o.durationMs,
                errorMessage: o.errorMessage,
                createdAt: o.createdAt,
              })),
            }
          : null,
        documents: (raw.documents ?? []).map((d: any) => ({
          id: d.id,
          docType: d.docType,
          fileName: d.fileName,
          fileUrl: d.fileUrl,
          mimeType: d.mimeType,
          createdAt: d.createdAt,
        })),
        resumeVersions: (raw.resumeVersions ?? []).map((r: any) => ({
          id: r.id,
          version: r.version ?? 'v1.0',
          fileUrl: r.fileUrl,
          source: r.source ?? 'uploaded',
          isCurrent: r.isCurrent ?? false,
          createdAt: r.createdAt,
        })),
        activities: (raw.activities ?? []).map((a: any) => ({
          id: a.id,
          activityType: a.activityType,
          title: a.title,
          description: a.description,
          createdBy: a.createdBy,
          createdAt: a.createdAt,
        })),
      };
      setConsultant(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load consultant');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchConsultant();
  }, [fetchConsultant]);

  // Auto-refresh while AI is processing
  useEffect(() => {
    if (!consultant?.latestAiRun) return;
    const { status } = consultant.latestAiRun;
    if (status !== 'PROCESSING' && status !== 'QUEUED') return;
    const timer = setInterval(fetchConsultant, 5000);
    return () => clearInterval(timer);
  }, [consultant?.latestAiRun?.status, fetchConsultant]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleTriggerAi = async () => {
    setTriggeringAi(true);
    try {
      await api.post(`/bench-intake/consultant/${id}/trigger-ai`);
      showToast('AI pipeline started');
      fetchConsultant();
    } catch {
      showToast('Failed to start AI pipeline', 'error');
    } finally {
      setTriggeringAi(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Bench Consultant" description="Loading..." />
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      </>
    );
  }

  if (error || !consultant) {
    return (
      <>
        <PageHeader title="Bench Consultant" description="Error" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">{error || 'Not found'}</p>
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
  const aiRun = c.latestAiRun;
  const outputsByStep: Record<string, AiOutput> = {};
  if (aiRun?.outputs) {
    for (const o of aiRun.outputs) {
      outputsByStep[o.step] = o;
    }
  }

  // Build tabs
  const tabs: { key: TabKey; label: string; icon: typeof SparklesIcon }[] = [
    { key: 'overview', label: 'Overview', icon: UserIcon },
    ...ALL_STEPS.map((step) => ({
      key: step as TabKey,
      label: AI_STEP_CONFIG[step]?.label ?? step,
      icon: AI_STEP_CONFIG[step]?.icon ?? SparklesIcon,
    })),
    { key: 'documents', label: 'Documents', icon: FolderIcon },
    { key: 'timeline', label: 'Timeline', icon: ClockIcon },
  ];

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

      {/* Back + Header */}
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
          [c.benchStatus?.replace(/_/g, ' '), c.visaType].filter(Boolean).join(' · ') || undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerAi}
              disabled={triggeringAi || aiRun?.status === 'PROCESSING'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
            >
              {triggeringAi ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
              {aiRun?.status === 'PROCESSING' ? 'AI Running...' : 'Run AI Pipeline'}
            </button>
            <button
              onClick={() => { setLoading(true); fetchConsultant(); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ClickableMetric metric="benchSize" title="Bench Status">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Status</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold mt-1 ${
              BENCH_STATUS_COLORS[c.benchStatus] ?? 'bg-gray-100 text-gray-600'
            }`}>
              {c.benchStatus?.replace(/_/g, ' ')}
            </span>
          </div>
        </ClickableMetric>
        <ClickableMetric metric="matchQuality" title="Readiness Score">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Readiness</p>
            <p className={`text-2xl font-bold mt-0.5 ${scoreTextColor(c.readinessScore)}`}>
              {c.readinessScore != null ? Math.round(c.readinessScore) : '--'}
              <span className="text-sm text-gray-400">/100</span>
            </p>
          </div>
        </ClickableMetric>
        <ClickableMetric metric="autoSubmitQueue" title="AI Pipeline">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">AI Pipeline</p>
            <p className="text-sm font-semibold mt-1">
              {aiRun ? `${aiRun.stepsCompleted}/${aiRun.totalSteps} steps` : 'Not started'}
            </p>
            {aiRun && (
              <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    aiRun.status === 'COMPLETED' ? 'bg-emerald-500'
                    : aiRun.status === 'FAILED' ? 'bg-red-500'
                    : 'bg-indigo-500'
                  }`}
                  style={{ width: `${(aiRun.stepsCompleted / aiRun.totalSteps) * 100}%` }}
                />
              </div>
            )}
          </div>
        </ClickableMetric>
        <ClickableMetric metric="submissions" title="Desired Rate">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Rate</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {c.desiredRate != null ? `$${c.desiredRate}` : '--'}
              <span className="text-sm text-gray-400">/hr</span>
            </p>
          </div>
        </ClickableMetric>
      </div>

      {/* AI Pipeline Steps — visual tracker */}
      {aiRun && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">AI Pipeline Progress</h3>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {ALL_STEPS.map((step, i) => {
              const output = outputsByStep[step];
              const status = output?.status ?? 'QUEUED';
              const cfg = AI_STEP_CONFIG[step];
              const Icon = cfg?.icon ?? SparklesIcon;
              return (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => setActiveTab(step as TabKey)}
                    className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-center transition min-w-[80px] ${
                      activeTab === step
                        ? 'bg-indigo-50 ring-1 ring-indigo-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {stepStatusIcon(status)}
                      <Icon className="h-4 w-4 text-gray-500" />
                    </div>
                    <span className="text-[10px] font-medium text-gray-600 leading-tight">
                      {cfg?.label ?? step}
                    </span>
                  </button>
                  {i < ALL_STEPS.length - 1 && (
                    <div className={`h-0.5 w-4 ${
                      (output?.status === 'COMPLETED') ? 'bg-emerald-400' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex gap-1 min-w-max" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const isAiStep = ALL_STEPS.includes(tab.key);
            const stepOutput = isAiStep ? outputsByStep[tab.key] : null;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`group inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-0.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {isAiStep && stepOutput && stepStatusIcon(stepOutput.status)}
                <tab.icon
                  className={`h-4 w-4 ${
                    isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab consultant={c} onItemClick={setSelectedRow} onRefresh={fetchConsultant} showToast={showToast} />}
        {ALL_STEPS.includes(activeTab) && (
          <AiStepTab step={activeTab} output={outputsByStep[activeTab] ?? null} />
        )}
        {activeTab === 'documents' && <DocumentsTab documents={c.documents} onItemClick={setSelectedRow} />}
        {activeTab === 'timeline' && <TimelineTab activities={c.activities} onItemClick={setSelectedRow} />}
      </div>

      {selectedRow && (
        <StaticDrillDownModal
          title={selectedRow.title || selectedRow.fileName || selectedRow.status || "Details"}
          rows={[selectedRow]}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Overview                                                      */
/* ------------------------------------------------------------------ */

function OverviewTab({
  consultant: c,
  onItemClick,
  onRefresh,
  showToast,
}: {
  consultant: BenchConsultantDetail;
  onItemClick: (item: any) => void;
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [editingSkills, setEditingSkills] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [editedSkills, setEditedSkills] = useState<string[]>(c.skills);
  const [savingSkills, setSavingSkills] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const skillInputRef = useRef<HTMLInputElement>(null);

  const handleAddSkill = () => {
    const newSkills = skillInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !editedSkills.some((es) => es.toLowerCase() === s.toLowerCase()));
    if (newSkills.length > 0) {
      setEditedSkills([...editedSkills, ...newSkills]);
    }
    setSkillInput('');
    skillInputRef.current?.focus();
  };

  const handleRemoveSkill = (skill: string) => {
    setEditedSkills(editedSkills.filter((s) => s !== skill));
  };

  const handleSaveSkills = async () => {
    setSavingSkills(true);
    try {
      await api.patch(`/bench-intake/consultant/${c.id}`, { skills: editedSkills });
      showToast(`Skills updated (${editedSkills.length} skills)`);
      setEditingSkills(false);
      onRefresh();
    } catch {
      showToast('Failed to save skills', 'error');
    } finally {
      setSavingSkills(false);
    }
  };

  const handleSaveAndRerun = async () => {
    setRerunning(true);
    try {
      await api.patch(`/bench-intake/consultant/${c.id}`, { skills: editedSkills });
      await api.post(`/bench-intake/consultant/${c.id}/trigger-ai`);
      showToast('Skills saved & AI pipeline re-started');
      setEditingSkills(false);
      onRefresh();
    } catch {
      showToast('Failed to save & re-run', 'error');
    } finally {
      setRerunning(false);
    }
  };

  // Compute score breakdown locally for display
  const skillCount = c.skills.length;
  const hasResume = (c.documents?.length > 0) || (c.resumeVersions?.length > 0);
  const hasVisa = !!c.visaType;
  const hasPhone = !!c.phone;
  const hasEmail = !!c.email;
  const hasRate = c.desiredRate != null;
  const hasAvailability = !!c.availableFrom;

  let resumeQuality = 50;
  if (hasResume) resumeQuality += 30;
  if (skillCount >= 1) resumeQuality += 5;
  if (skillCount >= 3) resumeQuality += 5;
  if (skillCount >= 6) resumeQuality += 5;
  if (skillCount >= 10) resumeQuality += 5;
  resumeQuality = Math.min(100, resumeQuality);

  let skillsDepth = 50;
  if (skillCount >= 1) skillsDepth += 10;
  if (skillCount >= 3) skillsDepth += 10;
  if (skillCount >= 5) skillsDepth += 10;
  if (skillCount >= 8) skillsDepth += 10;
  if (skillCount >= 12) skillsDepth += 10;
  skillsDepth = Math.min(100, skillsDepth);

  let marketFit = 55;
  if (hasVisa) marketFit += 15;
  if (hasRate) marketFit += 10;
  if (hasAvailability) marketFit += 10;
  if (skillCount >= 3) marketFit += 5;
  if (skillCount >= 8) marketFit += 5;
  marketFit = Math.min(100, marketFit);

  let interviewReadiness = 55;
  if (hasResume) interviewReadiness += 15;
  if (skillCount >= 3) interviewReadiness += 10;
  if (skillCount >= 6) interviewReadiness += 10;
  if (hasPhone) interviewReadiness += 5;
  if (hasRate) interviewReadiness += 5;
  interviewReadiness = Math.min(100, interviewReadiness);

  let docComplete = 30;
  if (hasResume) docComplete += 20;
  if (hasEmail) docComplete += 10;
  if (hasPhone) docComplete += 10;
  if (hasVisa) docComplete += 10;
  if (hasRate) docComplete += 10;
  if (hasAvailability) docComplete += 5;
  if (skillCount >= 1) docComplete += 5;
  docComplete = Math.min(100, docComplete);

  const breakdown = [
    { label: 'Resume Quality', score: resumeQuality, weight: 25, tip: !hasResume ? 'Upload a resume (+30 pts)' : skillCount < 10 ? 'Add more skills to boost' : null },
    { label: 'Skills Depth', score: skillsDepth, weight: 20, tip: skillCount < 12 ? `Add ${12 - skillCount} more skills for max score` : null },
    { label: 'Market Fit', score: marketFit, weight: 20, tip: !hasVisa ? 'Add visa type (+15 pts)' : !hasRate ? 'Set desired rate (+10 pts)' : !hasAvailability ? 'Set availability date (+10 pts)' : null },
    { label: 'Interview Readiness', score: interviewReadiness, weight: 15, tip: !hasResume ? 'Upload resume (+15 pts)' : skillCount < 6 ? 'Add more skills (+10 pts)' : null },
    { label: 'Doc Completeness', score: docComplete, weight: 20, tip: !hasResume ? 'Upload resume (+20 pts)' : !hasPhone ? 'Add phone (+10 pts)' : null },
  ];

  return (
    <div className="space-y-6">
      {/* Contact + Details */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Contact Information
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <EnvelopeIcon className="h-4 w-4 text-gray-400" />
            <a href={`mailto:${c.email}`} className="text-indigo-600 hover:underline">{c.email}</a>
          </div>
          {c.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <PhoneIcon className="h-4 w-4 text-gray-400" />
              {c.phone}
            </div>
          )}
          {c.visaType && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <ShieldCheckIcon className="h-4 w-4 text-gray-400" />
              {c.visaType}
            </div>
          )}
          {c.desiredRate != null && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
              ${c.desiredRate}/hr
            </div>
          )}
          {c.availableFrom && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <ClockIcon className="h-4 w-4 text-gray-400" />
              Available: {new Date(c.availableFrom).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Resume / Documents */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Resume & Documents ({c.documents.length + c.resumeVersions.length})
          </h3>
          <label className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
            <CloudArrowUpIcon className="h-3.5 w-3.5" />
            Upload Resume
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) {
                  showToast('File must be under 10MB', 'error');
                  return;
                }
                try {
                  const formData = new FormData();
                  formData.append('resume', file);
                  formData.append('firstName', c.firstName);
                  formData.append('lastName', c.lastName);
                  formData.append('email', c.email);
                  const token = (await import('@/lib/auth')).useAuthStore.getState().token;
                  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
                  const res = await fetch(`${API_BASE}/bench-intake/consultant/${c.id}/upload-resume`, {
                    method: 'POST',
                    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: formData,
                  });
                  if (!res.ok) throw new Error('Upload failed');
                  showToast('Resume uploaded successfully');
                  onRefresh();
                } catch {
                  showToast('Failed to upload resume', 'error');
                }
              }}
            />
          </label>
        </div>

        {c.documents.length === 0 && c.resumeVersions.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <DocumentTextIcon className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No resume uploaded yet</p>
            <p className="mt-1 text-xs text-gray-400">Upload a resume to improve the readiness score</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Show documents (ORIGINAL_RESUME, etc.) */}
            {c.documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <DocumentTextIcon className="h-8 w-8 text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {doc.docType.replace(/_/g, ' ')} · {new Date(doc.createdAt).toLocaleDateString()}
                    {doc.mimeType && ` · ${doc.mimeType.split('/').pop()?.toUpperCase()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {doc.fileUrl.startsWith('data:') && (
                    <>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        View
                      </a>
                      <a
                        href={doc.fileUrl}
                        download={doc.fileName}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Show resume versions */}
            {c.resumeVersions
              .filter((r) => !c.documents.some((d) => d.fileUrl === r.fileUrl))
              .map((rv) => (
                <div key={rv.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <DocumentTextIcon className="h-8 w-8 text-purple-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      Resume {rv.version}
                      {rv.isCurrent && (
                        <span className="ml-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Current
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {rv.source} · {new Date(rv.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {rv.fileUrl.startsWith('data:') && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={rv.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        View
                      </a>
                      <a
                        href={rv.fileUrl}
                        download={`resume-${rv.version}.pdf`}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Skills — Editable */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Skills ({editingSkills ? editedSkills.length : c.skills.length})
          </h3>
          {!editingSkills && (
            <button
              onClick={() => { setEditedSkills([...c.skills]); setEditingSkills(true); }}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Edit Skills
            </button>
          )}
        </div>

        {editingSkills ? (
          <div className="space-y-3">
            {/* Current skills as removable tags */}
            <div className="flex flex-wrap gap-2">
              {editedSkills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200"
                >
                  {skill}
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="ml-0.5 rounded-full p-0.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add skills input */}
            <div className="flex gap-2">
              <input
                ref={skillInputRef}
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                placeholder="Add skills (comma-separated): Python, AWS, React..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleAddSkill}
                disabled={!skillInput.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4" />
                Add
              </button>
            </div>

            {/* Quick-add popular skills */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Quick add:</p>
              <div className="flex flex-wrap gap-1.5">
                {['Java', 'Python', 'JavaScript', 'React', 'Angular', 'Node.js', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'SQL', 'MongoDB', 'TypeScript', 'Spring Boot', '.NET', 'C#', 'Go', 'Terraform', 'CI/CD', 'Microservices', 'REST API', 'GraphQL', 'Kafka', 'Redis']
                  .filter((s) => !editedSkills.some((es) => es.toLowerCase() === s.toLowerCase()))
                  .slice(0, 15)
                  .map((skill) => (
                    <button
                      key={skill}
                      onClick={() => setEditedSkills([...editedSkills, skill])}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition"
                    >
                      + {skill}
                    </button>
                  ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={handleSaveAndRerun}
                disabled={savingSkills || rerunning}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
              >
                {rerunning ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PlayIcon className="h-4 w-4" />}
                Save & Re-run AI Pipeline
              </button>
              <button
                onClick={handleSaveSkills}
                disabled={savingSkills || rerunning}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {savingSkills && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                Save Only
              </button>
              <button
                onClick={() => { setEditingSkills(false); setEditedSkills([...c.skills]); setSkillInput(''); }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {c.skills.length > 0 ? (
              c.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200"
                >
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-sm text-gray-400 italic">No skills added yet — click Edit Skills to add some</p>
            )}
          </div>
        )}
      </div>

      {/* Readiness Score + Breakdown */}
      {c.readinessScore != null && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Readiness Score</h3>
          <div className="flex items-center gap-4 mb-5">
            <div className={`text-4xl font-bold ${scoreTextColor(c.readinessScore)}`}>
              {Math.round(c.readinessScore)}
            </div>
            <div className="flex-1">
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${scoreColor(c.readinessScore)}`}
                  style={{ width: `${Math.min(c.readinessScore, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Breakdown categories */}
          <div className="space-y-3">
            {breakdown.map((cat) => (
              <div key={cat.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">{cat.label} ({cat.weight}%)</span>
                  <span className={`text-xs font-bold ${cat.score >= 80 ? 'text-emerald-600' : cat.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {cat.score}/100
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${cat.score >= 80 ? 'bg-emerald-500' : cat.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${cat.score}%` }}
                  />
                </div>
                {cat.tip && (
                  <p className="mt-0.5 text-[10px] text-amber-600">{cat.tip}</p>
                )}
              </div>
            ))}
          </div>

          {/* Tips to improve */}
          {c.readinessScore < 90 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">How to reach 90+:</p>
              <ul className="text-xs text-amber-700 space-y-0.5 list-disc pl-4">
                {!hasResume && <li>Upload a resume document</li>}
                {skillCount < 12 && <li>Add more skills (aim for 12+) — click Edit Skills above</li>}
                {!hasVisa && <li>Add visa/work authorization type</li>}
                {!hasRate && <li>Set a desired hourly rate</li>}
                {!hasAvailability && <li>Set an availability date</li>}
                {!hasPhone && <li>Add a phone number</li>}
                {skillCount >= 12 && hasResume && hasVisa && hasRate && hasAvailability && hasPhone && (
                  <li>Re-run the AI pipeline to recalculate your score</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: AI Step Output                                                */
/* ------------------------------------------------------------------ */

function AiStepTab({ step, output }: { step: string; output: AiOutput | null }) {
  const config = AI_STEP_CONFIG[step];

  if (!output) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <ClockIcon className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm font-medium text-gray-600">{config?.label ?? step}</p>
        <p className="mt-1 text-xs text-gray-400">This step has not been executed yet. Run the AI pipeline to generate results.</p>
      </div>
    );
  }

  if (output.status === 'PROCESSING') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-12 text-center">
        <ArrowPathIcon className="mx-auto h-8 w-8 animate-spin text-amber-500" />
        <p className="mt-3 text-sm font-medium text-amber-800">Processing {config?.label ?? step}...</p>
        <p className="mt-1 text-xs text-amber-600">This will update automatically when complete.</p>
      </div>
    );
  }

  if (output.status === 'FAILED') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <ExclamationCircleIcon className="mx-auto h-8 w-8 text-red-400" />
        <p className="mt-2 text-sm font-medium text-red-700">{config?.label ?? step} Failed</p>
        {output.errorMessage && (
          <p className="mt-1 text-xs text-red-500">{output.errorMessage}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Meta info */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {output.durationMs != null && (
          <span>Duration: {(output.durationMs / 1000).toFixed(1)}s</span>
        )}
        {output.tokensUsed != null && <span>Tokens: {output.tokensUsed.toLocaleString()}</span>}
        <span>Completed: {new Date(output.createdAt).toLocaleString()}</span>
      </div>

      {/* HTML content */}
      {output.htmlContent && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <style dangerouslySetInnerHTML={{ __html: AI_OUTPUT_STYLES }} />
          <div
            className="ai-content prose prose-sm max-w-none p-6"
            dangerouslySetInnerHTML={{ __html: output.htmlContent }}
          />
        </div>
      )}

      {/* JSON output fallback */}
      {!output.htmlContent && output.output && Object.keys(output.output).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(output.output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Documents                                                     */
/* ------------------------------------------------------------------ */

function DocumentsTab({ documents, onItemClick }: { documents: ConsultantDoc[]; onItemClick: (item: any) => void }) {
  if (!documents || documents.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <FolderIcon className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm font-medium text-gray-600">No documents uploaded</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div key={doc.id} onClick={() => onItemClick(doc)} className="cursor-pointer hover:bg-indigo-50 flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <DocumentTextIcon className="h-8 w-8 text-indigo-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
            <p className="text-xs text-gray-500">
              {doc.docType.replace(/_/g, ' ')} · {new Date(doc.createdAt).toLocaleDateString()}
              {doc.mimeType && ` · ${doc.mimeType}`}
            </p>
          </div>
          {doc.fileUrl.startsWith('data:') && (
            <a
              href={doc.fileUrl}
              download={doc.fileName}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Download
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Timeline                                                      */
/* ------------------------------------------------------------------ */

function TimelineTab({ activities, onItemClick }: { activities: Activity[]; onItemClick: (item: any) => void }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <ClockIcon className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm font-medium text-gray-600">No activity yet</p>
      </div>
    );
  }

  const ACTIVITY_ICONS: Record<string, string> = {
    AI_RUN_STARTED: 'bg-purple-100 text-purple-600',
    AI_STEP_COMPLETED: 'bg-emerald-100 text-emerald-600',
    STATUS_CHANGED: 'bg-blue-100 text-blue-600',
    RESUME_UPLOADED: 'bg-indigo-100 text-indigo-600',
    CONSULTANT_ADDED: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-0">
      {activities.map((activity, i) => (
        <div key={activity.id} onClick={() => onItemClick(activity)} className="cursor-pointer hover:bg-indigo-50 rounded-lg flex gap-4 pb-4">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
              ACTIVITY_ICONS[activity.activityType] ?? 'bg-gray-100 text-gray-500'
            }`}>
              <SparklesIcon className="h-4 w-4" />
            </div>
            {i < activities.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
          </div>
          {/* Content */}
          <div className="flex-1 pb-2">
            <p className="text-sm font-medium text-gray-900">{activity.title}</p>
            {activity.description && (
              <p className="mt-0.5 text-xs text-gray-500">{activity.description}</p>
            )}
            <p className="mt-1 text-[10px] text-gray-400">
              {new Date(activity.createdAt).toLocaleString()}
              {activity.createdBy && activity.createdBy !== 'system' && ` · by ${activity.createdBy}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
