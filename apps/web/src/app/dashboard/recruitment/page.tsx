'use client';

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

const OPEN_JOBS = [
  {
    id: 'J-1001',
    title: 'Senior React Developer',
    vendor: 'TechStream Solutions',
    skills: ['React', 'TypeScript', 'Node.js'],
    location: 'Remote',
    rate: '$85-95/hr',
    status: 'OPEN',
    submissions: 6,
    matchScore: 88,
    daysOpen: 5,
  },
  {
    id: 'J-1002',
    title: 'Cloud Infrastructure Engineer',
    vendor: 'Apex Staffing Group',
    skills: ['AWS', 'Terraform', 'Kubernetes'],
    location: 'Hybrid — Austin, TX',
    rate: '$90-110/hr',
    status: 'OPEN',
    submissions: 3,
    matchScore: 72,
    daysOpen: 12,
  },
  {
    id: 'J-1003',
    title: 'Data Engineer',
    vendor: 'NovaTech Partners',
    skills: ['Python', 'Spark', 'Airflow', 'SQL'],
    location: 'Remote',
    rate: '$75-85/hr',
    status: 'OPEN',
    submissions: 8,
    matchScore: 91,
    daysOpen: 3,
  },
  {
    id: 'J-1004',
    title: 'Full Stack Developer',
    vendor: 'ProConnect Inc.',
    skills: ['Java', 'Spring Boot', 'Angular'],
    location: 'Onsite — NYC',
    rate: '$80-100/hr',
    status: 'ON_HOLD',
    submissions: 2,
    matchScore: 65,
    daysOpen: 20,
  },
  {
    id: 'J-1005',
    title: 'DevOps Lead',
    vendor: 'TechStream Solutions',
    skills: ['CI/CD', 'Docker', 'AWS', 'Jenkins'],
    location: 'Remote',
    rate: '$95-120/hr',
    status: 'OPEN',
    submissions: 4,
    matchScore: 79,
    daysOpen: 7,
  },
];

const TODAYS_SUBMISSIONS = [
  { consultant: 'Sarah Chen', job: 'Sr. React Developer', vendor: 'TechStream', status: 'SUBMITTED', time: '9:15 AM' },
  { consultant: 'Ravi Patel', job: 'Cloud Infra Engineer', vendor: 'Apex Staffing', status: 'PENDING_CONSENT', time: '10:32 AM' },
  { consultant: 'Maria Garcia', job: 'Data Engineer', vendor: 'NovaTech', status: 'SUBMITTED', time: '11:45 AM' },
  { consultant: 'James Wilson', job: 'Full Stack Developer', vendor: 'ProConnect', status: 'SHORTLISTED', time: '1:20 PM' },
];

const INTERVIEWS_TODAY = [
  { consultant: 'Alex Thompson', job: 'Sr. React Developer', time: '2:00 PM', type: 'Technical' },
  { consultant: 'Priya Sharma', job: 'Data Engineer', time: '3:30 PM', type: 'Client Final' },
  { consultant: 'Michael Lee', job: 'DevOps Lead', time: '4:00 PM', type: 'Screening' },
];

type JobRow = (typeof OPEN_JOBS)[number] & Record<string, unknown>;

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
    key: 'rate',
    header: 'Rate',
    sortable: true,
    render: (row) => <span className="font-medium">{row.rate}</span>,
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
        {row.submissions}
      </span>
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
        <span className="text-xs font-medium text-gray-600">{row.matchScore}%</span>
      </div>
    ),
  },
];

export default function RecruitmentPage() {
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
          value="28"
          change="+5"
          changeType="positive"
          subtitle="this week"
          icon={BriefcaseIcon}
        />
        <KpiCard
          title="Today's Submissions"
          value="12"
          change="+4"
          changeType="positive"
          subtitle="vs yesterday"
          icon={DocumentTextIcon}
        />
        <KpiCard
          title="Interviews Today"
          value="3"
          subtitle="scheduled"
          icon={CalendarIcon}
        />
        <KpiCard
          title="Match Quality"
          value="84%"
          change="+2.1%"
          changeType="positive"
          subtitle="avg score"
          icon={SparklesIcon}
        />
      </div>

      {/* Open Jobs Table */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Open Positions</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search jobs..."
              className="input w-64"
            />
          </div>
        </div>
        <DataTable
          columns={jobColumns}
          data={OPEN_JOBS as unknown as JobRow[]}
          keyField="id"
        />
      </div>

      {/* Bottom row */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's submissions */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Today&apos;s Submissions</h3>
          <div className="mt-4 space-y-3">
            {TODAYS_SUBMISSIONS.map((sub, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{sub.consultant}</p>
                  <p className="text-xs text-gray-500">
                    {sub.job} — {sub.vendor}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={sub.status} />
                  <span className="text-xs text-gray-400">{sub.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interview schedule */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Interview Schedule</h3>
          <div className="mt-4 space-y-3">
            {INTERVIEWS_TODAY.map((interview, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600">
                    {interview.time.split(' ')[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{interview.consultant}</p>
                    <p className="text-xs text-gray-500">{interview.job}</p>
                  </div>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {interview.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
