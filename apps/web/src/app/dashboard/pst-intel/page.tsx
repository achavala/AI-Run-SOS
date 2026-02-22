'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  MagnifyingGlassIcon,
  EnvelopeIcon,
  PaperClipIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  UserIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  LightBulbIcon,
  PhoneIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LinkIcon,
  ClockIcon,
  ChartBarIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

type Tab = 'overview' | 'contacts' | 'consultants' | 'signals';

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface OverviewData {
  totalEmails: number;
  totalAttachments: number;
  vendorCompanies: number;
  recruiterContacts: number;
  consultants: number;
  consultantsFromSpreadsheets: number;
  consultantsFromEmails: number;
  totalResumes: number;
  reqSignals: number;
  evidenceFacts: number;
  batches: Array<{ name: string; count: number }>;
  employmentTypes: Array<{ type: string; count: number }>;
}

interface Vendor {
  id: string;
  company: string;
  domain: string | null;
  emailCount: number;
  contactCount: number;
  reqSignalCount: number;
  lastSeenAt: string;
}

interface Skill {
  name: string;
  count: number;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  linkedIn: string | null;
  emailCount: number;
  lastSeenAt: string;
}

interface Consultant {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  skills: string[];
  resumeCount: number;
  sourceType: string | null;
  lastSeenAt: string;
}

interface ConsultantDetail extends Consultant {
  resumes: Array<{ filename: string; date: string }>;
}

interface ReqSignal {
  id: string;
  title: string;
  company: string | null;
  contactName: string | null;
  contactEmail: string | null;
  employmentType: string | null;
  rate: string | null;
  skills: string[];
  location: string | null;
}

const EMP_TYPE_COLORS: Record<string, string> = {
  C2C: 'bg-emerald-100 text-emerald-700',
  W2: 'bg-blue-100 text-blue-700',
  CONTRACT: 'bg-amber-100 text-amber-700',
  FULLTIME: 'bg-purple-100 text-purple-700',
};

const EMP_TYPE_LABELS: Record<string, string> = {
  C2C: 'C2C',
  W2: 'W2',
  CONTRACT: 'Contract',
  FULLTIME: 'Full-time',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function PstIntelPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'consultants', label: 'Consultants' },
    { key: 'signals', label: 'Req Signals' },
  ];

  return (
    <>
      <PageHeader
        title="Email Intelligence"
        description="Vendor graph, consultant pool, historical reqs — from emails + spreadsheets"
      />

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              activeTab === t.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'contacts' && <ContactsTab />}
      {activeTab === 'consultants' && <ConsultantsTab />}
      {activeTab === 'signals' && <ReqSignalsTab />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Overview
// ---------------------------------------------------------------------------

function OverviewTab() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<OverviewData>('/pst-intel/overview'),
      api.get<Vendor[]>('/pst-intel/vendors?limit=30'),
      api.get<Skill[]>('/pst-intel/skills'),
    ])
      .then(([ov, vn, sk]) => {
        setOverview(ov);
        setVendors(vn);
        setSkills(sk);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!overview) return <EmptyState message="No overview data available" />;

  const statCards: Array<{ label: string; value: number; sub?: string; icon: typeof EnvelopeIcon; color: string }> = [
    { label: 'Raw Emails', value: overview.totalEmails, icon: EnvelopeIcon, color: 'text-indigo-500' },
    { label: 'Attachments', value: overview.totalAttachments, icon: PaperClipIcon, color: 'text-sky-500' },
    { label: 'Vendor Companies', value: overview.vendorCompanies, icon: BuildingOfficeIcon, color: 'text-emerald-500' },
    { label: 'Recruiter Contacts', value: overview.recruiterContacts, icon: UserGroupIcon, color: 'text-violet-500' },
    { label: 'Consultants', value: overview.consultants, sub: `${formatNumber(overview.consultantsFromEmails)} email + ${formatNumber(overview.consultantsFromSpreadsheets)} spreadsheet`, icon: UserIcon, color: 'text-rose-500' },
    { label: 'Resumes', value: overview.totalResumes, icon: DocumentTextIcon, color: 'text-amber-500' },
    { label: 'Job Req Signals', value: overview.reqSignals, icon: BriefcaseIcon, color: 'text-teal-500' },
    { label: 'Evidence Facts', value: overview.evidenceFacts, icon: LightBulbIcon, color: 'text-orange-500' },
  ];

  const maxSkillCount = skills.length > 0 ? Math.max(...skills.map((s) => s.count)) : 1;

  return (
    <div className="space-y-8">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{s.label}</p>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatNumber(s.value)}
            </p>
            {s.sub && (
              <p className="mt-0.5 text-[10px] text-gray-400">{s.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* PST Batches */}
      {overview.batches && overview.batches.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">PST Batches</h3>
          <div className="flex flex-wrap gap-2">
            {overview.batches.map((b) => (
              <div
                key={b.name}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm"
              >
                <p className="text-xs font-medium text-gray-900">{b.name}</p>
                <p className="text-[10px] text-gray-500">
                  {formatNumber(b.count)} emails
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employment Type Breakdown */}
      {overview.employmentTypes && overview.employmentTypes.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Employment Type Breakdown</h3>
          <div className="flex flex-wrap gap-3">
            {overview.employmentTypes.map((et) => (
              <div
                key={et.type}
                className={`rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm`}
              >
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    EMP_TYPE_COLORS[et.type] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {EMP_TYPE_LABELS[et.type] ?? et.type}
                </span>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {formatNumber(et.count)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 30 Vendors */}
      {vendors.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Top 30 Vendors</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Emails</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Contacts</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Req Signals</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{v.company}</td>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{v.domain ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{v.emailCount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{v.contactCount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{v.reqSignalCount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(v.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Skills Distribution */}
      {skills.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Skills Distribution (Top 30)</h3>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
            {skills.slice(0, 30).map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-xs text-gray-700 text-right">
                  {s.name}
                </span>
                <div className="flex-1 h-5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${(s.count / maxSkillCount) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-xs text-gray-500 tabular-nums text-right">
                  {s.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Contacts
// ---------------------------------------------------------------------------

function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hasPhone, setHasPhone] = useState(false);

  const fetchContacts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search) params.set('search', search);
      if (hasPhone) params.set('hasPhone', 'true');
      const result = await api.get<{ contacts: Contact[]; pagination: Pagination }>(
        `/pst-intel/contacts?${params.toString()}`,
      );
      setContacts(result.contacts);
      setPagination(result.pagination);
    } catch {
      /* handled by error boundary */
    } finally {
      setLoading(false);
    }
  }, [search, hasPhone]);

  useEffect(() => {
    fetchContacts(1);
  }, [fetchContacts]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
            placeholder="Search name, email, phone..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasPhone}
            onChange={(e) => setHasPhone((e.target as HTMLInputElement).checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Has Phone
        </label>
        <span className="text-xs text-gray-500">
          {pagination.total.toLocaleString()} contacts
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <Spinner />
      ) : contacts.length === 0 ? (
        <EmptyState message="No contacts found" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">LinkedIn</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Emails</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{c.name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{c.email}</td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{c.company ?? '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {c.phone ? (
                      <button
                        onClick={() => navigator.clipboard.writeText(c.phone!)}
                        className="text-indigo-600 hover:text-indigo-500 hover:underline"
                        title="Click to copy"
                      >
                        {c.phone}
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {c.linkedIn ? (
                      <a
                        href={c.linkedIn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-indigo-600 hover:text-indigo-500"
                        title={c.linkedIn}
                      >
                        <LinkIcon className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{c.emailCount.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(c.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <PaginationBar pagination={pagination} onPageChange={fetchContacts} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Consultants
// ---------------------------------------------------------------------------

function ConsultantsTab() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selected, setSelected] = useState<ConsultantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api.get<Skill[]>('/pst-intel/skills').then((sk) => setSkills(sk.slice(0, 30))).catch(() => {});
  }, []);

  const fetchConsultants = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search) params.set('search', search);
      if (skillFilter) params.set('skill', skillFilter);
      if (sourceFilter !== 'ALL') params.set('sourceType', sourceFilter);
      const result = await api.get<{ consultants: Consultant[]; pagination: Pagination }>(
        `/pst-intel/consultants?${params.toString()}`,
      );
      setConsultants(result.consultants);
      setPagination(result.pagination);
    } catch {
      /* handled by error boundary */
    } finally {
      setLoading(false);
    }
  }, [search, skillFilter, sourceFilter]);

  useEffect(() => {
    fetchConsultants(1);
  }, [fetchConsultants]);

  const selectConsultant = async (c: Consultant) => {
    setDetailLoading(true);
    try {
      const detail = await api.get<ConsultantDetail>(`/pst-intel/consultants/${c.id}`);
      setSelected(detail);
    } catch {
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
            placeholder="Search name, email..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={skillFilter}
          onChange={(e) => setSkillFilter((e.target as HTMLSelectElement).value)}
          className="rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Skills</option>
          {skills.map((s) => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter((e.target as HTMLSelectElement).value)}
          className="rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="ALL">All Sources</option>
          <option value="EMAIL">Email (PST)</option>
          <option value="SPREADSHEET">Spreadsheet</option>
        </select>
        <span className="text-xs text-gray-500">
          {pagination.total.toLocaleString()} consultants
        </span>
      </div>

      {loading ? (
        <Spinner />
      ) : consultants.length === 0 ? (
        <EmptyState message="No consultants found" />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Consultant list */}
          <div className="xl:col-span-2 space-y-3">
            {consultants.map((c) => (
              <button
                key={c.id}
                onClick={() => selectConsultant(c)}
                className={`w-full text-left rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                  selected?.id === c.id
                    ? 'border-indigo-400 ring-2 ring-indigo-100'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900">{c.fullName}</h3>
                    {c.email && <p className="mt-0.5 text-xs text-gray-500">{c.email}</p>}
                    {c.phone && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                        <PhoneIcon className="h-3 w-3" /> {c.phone}
                      </p>
                    )}
                    {c.skills && c.skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.skills.slice(0, 5).map((skill) => (
                          <span
                            key={skill}
                            className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                        {c.skills.length > 5 && (
                          <span className="text-[10px] text-gray-400">+{c.skills.length - 5} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    {c.sourceType && (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.sourceType === 'SPREADSHEET'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-sky-50 text-sky-700'
                      }`}>
                        {c.sourceType === 'SPREADSHEET' ? 'Sheet' : 'Email'}
                      </span>
                    )}
                    {c.resumeCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                        <DocumentTextIcon className="h-3 w-3" />
                        {c.resumeCount} resume{c.resumeCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {c.lastSeenAt && <p className="text-[10px] text-gray-400">{formatDate(c.lastSeenAt)}</p>}
                  </div>
                </div>
              </button>
            ))}

            <PaginationBar pagination={pagination} onPageChange={fetchConsultants} />
          </div>

          {/* Detail panel */}
          <div className="xl:col-span-1">
            {detailLoading ? (
              <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <Spinner />
              </div>
            ) : selected ? (
              <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{selected.fullName}</h3>
                  {selected.email && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-600">
                      <EnvelopeIcon className="h-4 w-4 text-gray-400" /> {selected.email}
                    </p>
                  )}
                  {selected.phone && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-600">
                      <PhoneIcon className="h-4 w-4 text-gray-400" /> {selected.phone}
                    </p>
                  )}
                  {selected.location && (
                    <p className="mt-0.5 text-sm text-gray-500">{selected.location}</p>
                  )}
                  {selected.sourceType && (
                    <span className="mt-1 inline-block rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                      {selected.sourceType}
                    </span>
                  )}
                </div>

                {/* Skills */}
                {selected.skills && selected.skills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.skills.map((skill) => (
                        <span
                          key={skill}
                          className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resumes */}
                {selected.resumes && selected.resumes.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Resume Versions</p>
                    <div className="space-y-1.5">
                      {selected.resumes.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
                        >
                          <DocumentTextIcon className="h-4 w-4 text-gray-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-700 truncate">{r.filename}</p>
                            <p className="text-[10px] text-gray-400">{formatDate(r.date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <p className="text-sm text-gray-400">Select a consultant to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Req Signals
// ---------------------------------------------------------------------------

function ReqSignalsTab() {
  const [signals, setSignals] = useState<ReqSignal[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [employmentType, setEmploymentType] = useState('ALL');

  const fetchSignals = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search) params.set('search', search);
      if (employmentType !== 'ALL') params.set('employmentType', employmentType);
      const result = await api.get<{ signals: ReqSignal[]; pagination: Pagination }>(
        `/pst-intel/req-signals?${params.toString()}`,
      );
      setSignals(result.signals);
      setPagination(result.pagination);
    } catch {
      /* handled by error boundary */
    } finally {
      setLoading(false);
    }
  }, [search, employmentType]);

  useEffect(() => {
    fetchSignals(1);
  }, [fetchSignals]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
            placeholder="Search title, company, skills..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={employmentType}
          onChange={(e) => setEmploymentType((e.target as HTMLSelectElement).value)}
          className="rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="ALL">All Types</option>
          <option value="C2C">C2C</option>
          <option value="W2">W2</option>
          <option value="CONTRACT">Contract</option>
          <option value="FULLTIME">Full-time</option>
        </select>
        <span className="text-xs text-gray-500">
          {pagination.total.toLocaleString()} signals
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <Spinner />
      ) : signals.length === 0 ? (
        <EmptyState message="No req signals found" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skills</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {signals.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap max-w-[200px] truncate">
                    {s.title}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{s.company ?? '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {s.contactName ? (
                      s.contactEmail ? (
                        <a
                          href={`mailto:${s.contactEmail}`}
                          className="text-indigo-600 hover:text-indigo-500 hover:underline"
                        >
                          {s.contactName}
                        </a>
                      ) : (
                        <span className="text-gray-700">{s.contactName}</span>
                      )
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {s.employmentType ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          EMP_TYPE_COLORS[s.employmentType] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {EMP_TYPE_LABELS[s.employmentType] ?? s.employmentType}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{s.rate ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {s.skills && s.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {s.skills.slice(0, 3).map((skill) => (
                          <span
                            key={skill}
                            className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                        {s.skills.length > 3 && (
                          <span className="text-[10px] text-gray-400">+{s.skills.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{s.location ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginationBar pagination={pagination} onPageChange={fetchSignals} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

function PaginationBar({
  pagination,
  onPageChange,
}: {
  pagination: Pagination;
  onPageChange: (page: number) => void;
}) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
      <span className="text-xs text-gray-500">
        Showing {(pagination.page - 1) * pagination.pageSize + 1}–
        {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
        {pagination.total.toLocaleString()}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
          className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
          className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
