'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  MagnifyingGlassIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  UserIcon,
  BriefcaseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  PhoneIcon,
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

type Tab = 'overview' | 'vendors' | 'consultants' | 'clients' | 'reqs' | 'skills';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'consultants', label: 'Consultants' },
  { id: 'clients', label: 'Clients' },
  { id: 'reqs', label: 'Req Signals' },
  { id: 'skills', label: 'Skills' },
];

function fmtNum(n: number | string) {
  return Number(n).toLocaleString();
}
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString() : '—';
}
function fmtDateTime(d: string | null) {
  return d ? new Date(d).toLocaleString() : '—';
}

function StatCard({ label, value, icon: Icon, color = 'indigo', onClick }: {
  label: string; value: string | number; icon: any; color?: string; onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600', green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600', purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 ${onClick ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all' : ''}`}
      onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${colors[color]}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? fmtNum(value) : value}</p>
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, total, onPageChange }: {
  page: number; totalPages: number; total: number; onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between py-4">
      <span className="text-sm text-gray-500">{fmtNum(total)} total</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="rounded-lg border p-2 disabled:opacity-30 hover:bg-gray-50">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="rounded-lg border p-2 disabled:opacity-30 hover:bg-gray-50">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DateRange({ dateFrom, dateTo, onChange }: {
  dateFrom: string; dateTo: string; onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
      <input type="date" value={dateFrom} onChange={(e) => onChange(e.target.value, dateTo)}
        className="rounded-lg border px-2 py-1.5 text-sm" />
      <span className="text-gray-400">to</span>
      <input type="date" value={dateTo} onChange={(e) => onChange(dateFrom, e.target.value)}
        className="rounded-lg border px-2 py-1.5 text-sm" />
      {(dateFrom || dateTo) && (
        <button onClick={() => onChange('', '')} className="rounded p-1 text-gray-400 hover:text-gray-600">
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SkillBadge({ skill, color = 'indigo' }: { skill: string; color?: string }) {
  const cls = color === 'green' ? 'bg-green-50 text-green-700' : 'bg-indigo-50 text-indigo-700';
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{skill}</span>;
}

function EmpTypeBadge({ type }: { type: string }) {
  const cls = type === 'C2C' ? 'bg-green-100 text-green-700' :
    type === 'W2' ? 'bg-blue-100 text-blue-700' :
    type === 'CONTRACT' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{type}</span>;
}

function ExportButton({ href, label }: { href: string; label: string }) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  return (
    <a href={`${API_BASE}${href}`} download
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
      <ArrowDownTrayIcon className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

/* ──────────── SLIDE-OVER DETAIL PANEL ──────────── */
function DetailPanel({ open, onClose, children }: {
  open: boolean; onClose: () => void; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-lg p-2 hover:bg-gray-100">
          <XMarkIcon className="h-5 w-5" />
        </button>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

/* ──────────── OVERVIEW TAB (with latest reqs) ──────────── */
function OverviewTab({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/mail-intel/overview').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>;
  if (!data) return <div className="py-20 text-center text-gray-400">No data available</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Emails" value={data.totalEmails} icon={EnvelopeIcon} color="indigo" />
        <StatCard label="Unique Senders" value={data.uniqueSenders} icon={UserGroupIcon} color="blue" />
        <StatCard label="Vendor Companies" value={data.vendorCompanies} icon={BuildingOfficeIcon} color="green"
          onClick={() => onNavigate('vendors')} />
        <StatCard label="Vendor Contacts" value={data.vendorContacts} icon={UserIcon} color="purple" />
        <StatCard label="Consultants" value={data.consultants} icon={UserGroupIcon} color="amber"
          onClick={() => onNavigate('consultants')} />
        <StatCard label="Req Signals" value={data.reqSignals} icon={BriefcaseIcon} color="rose"
          onClick={() => onNavigate('reqs')} />
      </div>

      {/* Latest Job Openings / Req Signals */}
      <div className="rounded-xl border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Latest Job Openings</h3>
          <button onClick={() => onNavigate('reqs')} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            View all {fmtNum(data.reqSignals)} reqs →
          </button>
        </div>
        <div className="space-y-3">
          {data.latestReqs?.slice(0, 10).map((r: any) => (
            <div key={r.id} className="flex items-start justify-between rounded-lg border px-4 py-3 hover:bg-gray-50">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{r.title || 'Untitled'}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {r.employmentType && <EmpTypeBadge type={r.employmentType} />}
                  {r.location && <span className="flex items-center gap-1"><MapPinIcon className="h-3 w-3" />{r.location}</span>}
                  {r.rateText && <span className="flex items-center gap-1 font-medium text-green-600"><CurrencyDollarIcon className="h-3 w-3" />{r.rateText}</span>}
                </div>
                {r.skills?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.skills.slice(0, 6).map((s: string) => <SkillBadge key={s} skill={s} />)}
                  </div>
                )}
              </div>
              <div className="ml-4 text-right text-xs text-gray-400">
                {r.vendorName && <p className="font-medium text-gray-600">{r.vendorName}</p>}
                {r.contactEmail && <p>{r.contactEmail}</p>}
                <p className="mt-1">{fmtDate(r.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h3 className="mb-4 font-semibold text-gray-900">Email Classification</h3>
          <div className="space-y-2">
            {data.categories?.map((c: any) => {
              const pct = data.totalEmails > 0 ? ((c.count / data.totalEmails) * 100).toFixed(1) : 0;
              const colors: Record<string, string> = {
                VENDOR_REQ: 'bg-green-500', CONSULTANT: 'bg-blue-500', INTERNAL: 'bg-gray-400',
                SYSTEM: 'bg-gray-300', PERSONAL: 'bg-yellow-400', VENDOR_OTHER: 'bg-emerald-400',
                CLIENT: 'bg-purple-500', OTHER: 'bg-gray-200',
              };
              return (
                <div key={c.category} className="flex items-center gap-3">
                  <div className="w-28 text-xs font-medium text-gray-600">{c.category}</div>
                  <div className="flex-1"><div className="h-5 rounded-full bg-gray-100">
                    <div className={`h-5 rounded-full ${colors[c.category] || 'bg-gray-400'}`}
                      style={{ width: `${Math.max(Number(pct), 0.5)}%` }} />
                  </div></div>
                  <div className="w-24 text-right text-xs text-gray-500">{fmtNum(c.count)} ({pct}%)</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h3 className="mb-4 font-semibold text-gray-900">Mailbox Breakdown</h3>
          <div className="space-y-3">
            {data.mailboxes?.map((m: any) => (
              <div key={m.email} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.email}</p>
                  <p className="text-xs text-gray-500">{fmtDate(m.oldestEmail)} — {fmtDate(m.newestEmail)}</p>
                </div>
                <span className="text-sm font-bold text-indigo-600">{fmtNum(m.count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h3 className="mb-4 font-semibold text-gray-900">Employment Types</h3>
          <div className="space-y-2">{data.employmentTypes?.map((e: any) => (
            <div key={e.type} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2">
              <EmpTypeBadge type={e.type} /><span className="font-bold text-sm">{fmtNum(e.count)}</span>
            </div>
          ))}</div>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <h3 className="mb-4 font-semibold text-gray-900">Client & Vendor Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Client Companies" value={data.clientCompanies} icon={BuildingOfficeIcon} color="purple"
              onClick={() => onNavigate('clients')} />
            <StatCard label="Client Contacts" value={data.clientContacts} icon={UserIcon} color="purple" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────── VENDORS TAB ──────────── */
function VendorsTab() {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (search) qs.set('search', search);
    if (dateFrom) qs.set('dateFrom', dateFrom);
    if (dateTo) qs.set('dateTo', dateTo);
    api.get(`/mail-intel/vendors?${qs}`).then(setData).finally(() => setLoading(false));
  }, [page, search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    const d = await api.get(`/mail-intel/vendors/${id}`);
    setDetail(d);
    setDetailLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="Search vendors (full-text)..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border py-2 pl-10 pr-4 text-sm" />
        </div>
        <DateRange dateFrom={dateFrom} dateTo={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); setPage(1); }} />
        <ExportButton href="/mail-intel/export/vendors" label="CSV" />
      </div>
      {loading ? <div className="py-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div> : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Domain</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Emails</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Contacts</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Reqs</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">First Seen</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.data?.map((v: any) => (
                  <tr key={v.id} className="cursor-pointer hover:bg-indigo-50 transition-colors"
                    onClick={() => openDetail(v.id)}>
                    <td className="px-4 py-3 font-mono text-xs text-indigo-600">{v.domain}</td>
                    <td className="px-4 py-3 font-medium">{v.name}</td>
                    <td className="px-4 py-3 text-right">{fmtNum(v.emailCount)}</td>
                    <td className="px-4 py-3 text-right">{v.contactCount}</td>
                    <td className="px-4 py-3 text-right">{v.reqCount}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(v.firstSeen)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(v.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} total={data?.pagination?.total || 0} onPageChange={setPage} />
        </>
      )}

      <DetailPanel open={!!detail || detailLoading} onClose={() => setDetail(null)}>
        {detailLoading ? (
          <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>
        ) : detail && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{detail.name}</h2>
              <p className="text-sm text-indigo-600">{detail.domain}</p>
              <div className="mt-3 flex gap-6 text-sm">
                <div><span className="text-gray-500">Emails:</span> <strong>{fmtNum(detail.emailCount)}</strong></div>
                <div><span className="text-gray-500">First seen:</span> <strong>{fmtDate(detail.firstSeen)}</strong></div>
                <div><span className="text-gray-500">Last seen:</span> <strong>{fmtDate(detail.lastSeen)}</strong></div>
              </div>
            </div>

            {detail.topSkills?.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold text-gray-700">Top Skills Requested</h3>
                <div className="flex flex-wrap gap-2">
                  {detail.topSkills.map((s: any) => (
                    <span key={s.name} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                      {s.name} <span className="text-indigo-400">({s.count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-3 font-semibold text-gray-700">Contacts ({detail.contacts?.length})</h3>
              <div className="space-y-2">
                {detail.contacts?.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div>
                      <p className="font-medium">{c.name || '—'}</p>
                      <p className="text-xs text-indigo-600">{c.email}</p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{fmtNum(c.emailCount)} emails</p>
                      <p>{fmtDate(c.lastSeen)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-gray-700">Recent Reqs ({detail.recentReqs?.length})</h3>
              <div className="space-y-2">
                {detail.recentReqs?.map((r: any) => (
                  <div key={r.id} className="rounded-lg border px-4 py-3">
                    <p className="font-medium text-gray-900">{r.title || 'Untitled'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {r.employmentType && <EmpTypeBadge type={r.employmentType} />}
                      {r.location && <span>{r.location}</span>}
                      {r.rateText && <span className="font-medium text-green-600">{r.rateText}</span>}
                      <span>{fmtDate(r.createdAt)}</span>
                    </div>
                    {r.skills?.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.skills.slice(0, 8).map((s: string) => <SkillBadge key={s} skill={s} />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DetailPanel>
    </div>
  );
}

/* ──────────── CONSULTANTS TAB ──────────── */
function ConsultantsTab() {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (search) qs.set('search', search);
    if (dateFrom) qs.set('dateFrom', dateFrom);
    if (dateTo) qs.set('dateTo', dateTo);
    api.get(`/mail-intel/consultants?${qs}`).then(setData).finally(() => setLoading(false));
  }, [page, search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    const d = await api.get(`/mail-intel/consultants/${id}`);
    setDetail(d);
    setDetailLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="Search by name, email, or skill..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border py-2 pl-10 pr-4 text-sm" />
        </div>
        <DateRange dateFrom={dateFrom} dateTo={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); setPage(1); }} />
        <ExportButton href="/mail-intel/export/consultants" label="CSV" />
      </div>
      {loading ? <div className="py-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div> : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Skills</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.data?.map((c: any) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-indigo-50 transition-colors"
                    onClick={() => openDetail(c.id)}>
                    <td className="px-4 py-3 font-medium">{c.fullName || '—'}</td>
                    <td className="px-4 py-3 text-xs text-indigo-600">{c.email}</td>
                    <td className="px-4 py-3 text-xs">{c.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.skills || []).slice(0, 4).map((s: string) => <SkillBadge key={s} skill={s} />)}
                        {(c.skills || []).length > 4 && <span className="text-xs text-gray-400">+{c.skills.length - 4}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(c.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} total={data?.pagination?.total || 0} onPageChange={setPage} />
        </>
      )}

      <DetailPanel open={!!detail || detailLoading} onClose={() => setDetail(null)}>
        {detailLoading ? (
          <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>
        ) : detail && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{detail.fullName || 'Unknown'}</h2>
              <div className="mt-2 space-y-1">
                {detail.email && <p className="flex items-center gap-2 text-sm"><EnvelopeIcon className="h-4 w-4 text-gray-400" /> {detail.email}</p>}
                {detail.phone && <p className="flex items-center gap-2 text-sm"><PhoneIcon className="h-4 w-4 text-gray-400" /> {detail.phone}</p>}
              </div>
              <div className="mt-3 flex gap-6 text-sm">
                <div><span className="text-gray-500">First seen:</span> <strong>{fmtDate(detail.firstSeen)}</strong></div>
                <div><span className="text-gray-500">Last seen:</span> <strong>{fmtDate(detail.lastSeen)}</strong></div>
              </div>
            </div>

            {detail.skills?.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold text-gray-700">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {detail.skills.map((s: string) => (
                    <span key={s} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {detail.matchingReqs?.length > 0 && (
              <div>
                <h3 className="mb-3 font-semibold text-gray-700">Matching Reqs (by skill overlap)</h3>
                <div className="space-y-2">
                  {detail.matchingReqs.map((r: any) => (
                    <div key={r.id} className="rounded-lg border px-4 py-3">
                      <p className="font-medium text-gray-900">{r.title || 'Untitled'}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {r.employmentType && <EmpTypeBadge type={r.employmentType} />}
                        {r.location && <span>{r.location}</span>}
                        {r.rateText && <span className="font-medium text-green-600">{r.rateText}</span>}
                        {r.vendorName && <span className="text-gray-600">{r.vendorName}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DetailPanel>
    </div>
  );
}

/* ──────────── CLIENTS TAB ──────────── */
function ClientsTab() {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (search) qs.set('search', search);
    if (dateFrom) qs.set('dateFrom', dateFrom);
    if (dateTo) qs.set('dateTo', dateTo);
    api.get(`/mail-intel/clients?${qs}`).then(setData).finally(() => setLoading(false));
  }, [page, search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    const d = await api.get(`/mail-intel/clients/${id}`);
    setDetail(d);
    setDetailLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="Search clients..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border py-2 pl-10 pr-4 text-sm" />
        </div>
        <DateRange dateFrom={dateFrom} dateTo={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); setPage(1); }} />
        <ExportButton href="/mail-intel/export/clients" label="CSV" />
      </div>
      {loading ? <div className="py-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div> : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Domain</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Emails</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Contacts</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">First Seen</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.data?.map((c: any) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-purple-50 transition-colors"
                    onClick={() => openDetail(c.id)}>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-purple-600">{c.domain}</td>
                    <td className="px-4 py-3 text-right">{fmtNum(c.emailCount)}</td>
                    <td className="px-4 py-3 text-right">{c.contactCount}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(c.firstSeen)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(c.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} total={data?.pagination?.total || 0} onPageChange={setPage} />
        </>
      )}

      <DetailPanel open={!!detail || detailLoading} onClose={() => setDetail(null)}>
        {detailLoading ? (
          <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>
        ) : detail && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{detail.name}</h2>
              <p className="text-sm text-purple-600">{detail.domain}</p>
              <div className="mt-3 flex gap-6 text-sm">
                <div><span className="text-gray-500">Emails:</span> <strong>{fmtNum(detail.emailCount)}</strong></div>
                <div><span className="text-gray-500">First seen:</span> <strong>{fmtDate(detail.firstSeen)}</strong></div>
                <div><span className="text-gray-500">Last seen:</span> <strong>{fmtDate(detail.lastSeen)}</strong></div>
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-gray-700">Contacts ({detail.contacts?.length})</h3>
              {detail.contacts?.length > 0 ? (
                <div className="space-y-2">
                  {detail.contacts.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <div>
                        <p className="font-medium">{c.name || '—'}</p>
                        <p className="text-xs text-purple-600">{c.email}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p>{fmtNum(c.emailCount)} emails</p>
                        <p>{fmtDate(c.lastSeen)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No contacts found</p>
              )}
            </div>
          </div>
        )}
      </DetailPanel>
    </div>
  );
}

/* ──────────── REQ SIGNALS TAB (with AI matching) ──────────── */
function ReqSignalsTab({ setActiveTab }: { setActiveTab: (t: Tab) => void }) {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [empType, setEmpType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [matchPanel, setMatchPanel] = useState<any>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (empType !== 'ALL') qs.set('empType', empType);
    if (search) qs.set('search', search);
    if (dateFrom) qs.set('dateFrom', dateFrom);
    if (dateTo) qs.set('dateTo', dateTo);
    api.get(`/mail-intel/req-signals?${qs}`).then(setData).finally(() => setLoading(false));
  }, [page, empType, search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const showMatches = async (reqId: string) => {
    setMatchLoading(true);
    setMatchPanel(null);
    const d = await api.get(`/mail-intel/req-signals/${reqId}/matches`);
    setMatchPanel(d);
    setMatchLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="Search by title, location, skills..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border py-2 pl-10 pr-4 text-sm" />
        </div>
        <select value={empType} onChange={(e) => { setEmpType(e.target.value); setPage(1); }}
          className="rounded-lg border px-3 py-2 text-sm">
          <option value="ALL">All Types</option>
          <option value="C2C">C2C</option>
          <option value="CONTRACT">Contract</option>
          <option value="W2">W2</option>
          <option value="C2H">C2H</option>
          <option value="FTE">FTE</option>
        </select>
        <DateRange dateFrom={dateFrom} dateTo={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); setPage(1); }} />
        <ExportButton href={`/mail-intel/export/reqs${empType !== 'ALL' ? `?empType=${empType}` : ''}`} label="CSV" />
      </div>
      {loading ? <div className="py-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div> : (
        <>
          <p className="text-sm text-gray-500">{fmtNum(data?.pagination?.total || 0)} req signals found</p>
          <div className="space-y-3">
            {data?.data?.map((r: any) => (
              <div key={r.id} className="rounded-xl border bg-white p-4 hover:border-indigo-200 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{r.title || 'Untitled Req'}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {r.employmentType && <EmpTypeBadge type={r.employmentType} />}
                      {r.location && <span className="flex items-center gap-1"><MapPinIcon className="h-3 w-3" />{r.location}</span>}
                      {r.rateText && <span className="flex items-center gap-1 font-medium text-green-600"><CurrencyDollarIcon className="h-3 w-3" />{r.rateText}</span>}
                      <span className="flex items-center gap-1"><ClockIcon className="h-3 w-3" />{fmtDate(r.createdAt)}</span>
                    </div>
                    {r.skills?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.skills.map((s: string) => <SkillBadge key={s} skill={s} />)}
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => showMatches(r.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                        <SparklesIcon className="h-3 w-3" /> Find Matches
                      </button>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    {r.vendorName && <p className="text-xs font-medium text-indigo-600">{r.vendorName}</p>}
                    {r.contactEmail && <p className="text-xs text-gray-400">{r.contactEmail}</p>}
                    {r.contactName && <p className="text-xs text-gray-500">{r.contactName}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} total={data?.pagination?.total || 0} onPageChange={setPage} />
        </>
      )}

      <DetailPanel open={!!matchPanel || matchLoading} onClose={() => setMatchPanel(null)}>
        {matchLoading ? (
          <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>
        ) : matchPanel && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{matchPanel.title || 'Untitled Req'}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                {matchPanel.employmentType && <EmpTypeBadge type={matchPanel.employmentType} />}
                {matchPanel.location && <span>{matchPanel.location}</span>}
                {matchPanel.rateText && <span className="font-medium text-green-600">{matchPanel.rateText}</span>}
              </div>
              {matchPanel.skills?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {matchPanel.skills.map((s: string) => <SkillBadge key={s} skill={s} />)}
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500">
                {matchPanel.vendorName && <span>Vendor: <strong>{matchPanel.vendorName}</strong></span>}
                {matchPanel.contactEmail && <span className="ml-3">{matchPanel.contactEmail}</span>}
              </div>
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-700">
                <SparklesIcon className="h-5 w-5 text-indigo-500" /> AI-Matched Consultants ({matchPanel.topMatches?.length || 0})
              </h3>
              {matchPanel.topMatches?.length > 0 ? (
                <div className="space-y-2">
                  {matchPanel.topMatches.map((c: any, i: number) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${
                          c.matchScore >= 70 ? 'bg-green-500' : c.matchScore >= 40 ? 'bg-amber-500' : 'bg-gray-400'
                        }`}>{c.matchScore}</div>
                        <div>
                          <p className="font-medium">{c.fullName}</p>
                          <p className="text-xs text-indigo-600">{c.email}</p>
                          {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {c.matchingSkills?.map((s: string) => (
                            <span key={s} className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">{s}</span>
                          ))}
                          {c.partialSkills?.map((s: string) => (
                            <span key={s} className="rounded bg-yellow-50 px-1.5 py-0.5 text-xs text-yellow-700">{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No matching consultants found for these skills</p>
              )}
            </div>
          </div>
        )}
      </DetailPanel>
    </div>
  );
}

/* ──────────── SKILLS TAB ──────────── */
function SkillsTab() {
  const [demand, setDemand] = useState<any[]>([]);
  const [supply, setSupply] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/mail-intel/skills-demand'),
      api.get('/mail-intel/skills-supply'),
    ]).then(([d, s]) => { setDemand(d as any[]); setSupply(s as any[]); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>;

  const maxD = demand[0]?.count || 1;
  const maxS = supply[0]?.count || 1;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border bg-white p-5">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Skills in Demand (from Req Signals)</h3>
        <div className="space-y-2">{demand.map((s: any) => (
          <div key={s.name} className="flex items-center gap-3">
            <div className="w-24 text-xs font-medium text-gray-700">{s.name}</div>
            <div className="flex-1"><div className="h-6 rounded-full bg-gray-100">
              <div className="h-6 rounded-full bg-indigo-500 flex items-center justify-end pr-2"
                style={{ width: `${(s.count / maxD) * 100}%` }}>
                <span className="text-xs font-bold text-white">{fmtNum(s.count)}</span>
              </div>
            </div></div>
          </div>
        ))}</div>
      </div>
      <div className="rounded-xl border bg-white p-5">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Skills in Supply (from Consultants)</h3>
        <div className="space-y-2">{supply.map((s: any) => (
          <div key={s.name} className="flex items-center gap-3">
            <div className="w-24 text-xs font-medium text-gray-700">{s.name}</div>
            <div className="flex-1"><div className="h-6 rounded-full bg-gray-100">
              <div className="h-6 rounded-full bg-green-500 flex items-center justify-end pr-2"
                style={{ width: `${(s.count / maxS) * 100}%` }}>
                <span className="text-xs font-bold text-white">{fmtNum(s.count)}</span>
              </div>
            </div></div>
          </div>
        ))}</div>
      </div>
    </div>
  );
}

/* ──────────── MAIN PAGE ──────────── */
export default function MailIntelPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div>
      <PageHeader
        title="Mail Intelligence"
        description="Live vendor graph, consultant pool, client map, and req signals — extracted from 392K+ emails across 5 mailboxes"
      />

      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab onNavigate={setActiveTab} />}
      {activeTab === 'vendors' && <VendorsTab />}
      {activeTab === 'consultants' && <ConsultantsTab />}
      {activeTab === 'clients' && <ClientsTab />}
      {activeTab === 'reqs' && <ReqSignalsTab setActiveTab={setActiveTab} />}
      {activeTab === 'skills' && <SkillsTab />}
    </div>
  );
}
