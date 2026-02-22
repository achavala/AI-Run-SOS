'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  UserIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';

interface VendorReq {
  id: string;
  vendorId: string | null;
  vendorContactId: string | null;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  receivedAt: string;
  title: string | null;
  description: string | null;
  location: string | null;
  locationType: string | null;
  employmentType: string;
  rateText: string | null;
  hourlyRateMin: number | null;
  hourlyRateMax: number | null;
  duration: string | null;
  clientHint: string | null;
  skills: string[];
  negativeSignals: string[];
  realnessScore: number | null;
  actionabilityScore: number | null;
  matchedByDomain: boolean;
  status: string;
  convertedToJobId: string | null;
  convertedAt: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface Stats {
  total: number;
  new: number;
  reviewed: number;
  converted: number;
  rejected: number;
}

const TYPE_COLORS: Record<string, string> = {
  C2C: 'bg-purple-100 text-purple-700 ring-purple-600/20',
  W2: 'bg-blue-100 text-blue-700 ring-blue-600/20',
  W2_1099: 'bg-teal-100 text-teal-700 ring-teal-600/20',
  CONTRACT: 'bg-amber-100 text-amber-700 ring-amber-600/20',
  FULLTIME: 'bg-green-100 text-green-700 ring-green-600/20',
  PARTTIME: 'bg-gray-100 text-gray-700 ring-gray-600/20',
  UNKNOWN: 'bg-gray-50 text-gray-500 ring-gray-400/20',
};

const TYPE_LABELS: Record<string, string> = {
  C2C: 'C2C',
  W2: 'W2',
  W2_1099: 'W2/1099',
  CONTRACT: 'Contract',
  FULLTIME: 'Full-time',
  PARTTIME: 'Part-time',
  UNKNOWN: 'Unknown',
};

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700 ring-blue-600/20',
  REVIEWED: 'bg-amber-100 text-amber-700 ring-amber-600/20',
  CONVERTED: 'bg-green-100 text-green-700 ring-green-600/20',
  REJECTED: 'bg-gray-100 text-gray-600 ring-gray-500/20',
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

export default function VendorReqsPage() {
  const [reqs, setReqs] = useState<VendorReq[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<VendorReq | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [employmentType, setEmploymentType] = useState('ALL');

  const fetchReqs = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search) params.set('search', search);
      if (status !== 'ALL') params.set('status', status);
      if (employmentType !== 'ALL') params.set('employmentType', employmentType);

      const result = await api.get<{ reqs: VendorReq[]; pagination: Pagination }>(
        `/vendor-reqs?${params.toString()}`,
      );
      setReqs(result.reqs);
      setPagination(result.pagination);
    } catch {
      /* handled by error boundary */
    } finally {
      setLoading(false);
    }
  }, [search, status, employmentType]);

  const fetchStats = useCallback(async () => {
    try {
      const result = await api.get<Stats>('/vendor-reqs/stats');
      setStats(result);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchReqs(1);
    fetchStats();
  }, [fetchReqs, fetchStats]);

  if (loading && reqs.length === 0) {
    return (
      <>
        <PageHeader title="Vendor Reqs" description="Tier A — Actionable reqs from vendor emails" />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Vendor Reqs" description="Tier A — Actionable reqs from vendor emails" />

      {/* Stats Bar */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="New" value={String(stats.new)} accent />
          <StatCard label="Reviewed" value={String(stats.reviewed)} />
          <StatCard label="Converted" value={String(stats.converted)} />
          <StatCard label="Total" value={String(stats.total)} />
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
            placeholder="Search subject, title, email..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ALL', label: 'All Status' },
            { value: 'NEW', label: 'New' },
            { value: 'REVIEWED', label: 'Reviewed' },
            { value: 'CONVERTED', label: 'Converted' },
            { value: 'REJECTED', label: 'Rejected' },
          ]}
        />
        <FilterSelect
          value={employmentType}
          onChange={setEmploymentType}
          options={[
            { value: 'ALL', label: 'All Types' },
            { value: 'C2C', label: 'C2C' },
            { value: 'W2', label: 'W2' },
            { value: 'CONTRACT', label: 'Contract' },
          ]}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Req List */}
        <div className="xl:col-span-2 space-y-3">
          {reqs.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">
                No vendor reqs match your filters.
              </p>
            </div>
          ) : (
            reqs.map((req) => (
              <button
                key={req.id}
                onClick={() => setSelectedReq(req)}
                className={`w-full text-left rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                  selectedReq?.id === req.id
                    ? 'border-indigo-400 ring-2 ring-indigo-100'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {req.subject}
                      </h3>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                          TYPE_COLORS[req.employmentType] ?? TYPE_COLORS.UNKNOWN
                        }`}
                      >
                        {TYPE_LABELS[req.employmentType] ?? req.employmentType}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                          STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {req.status}
                      </span>
                      {req.matchedByDomain && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          <CheckBadgeIcon className="h-3 w-3" /> Matched Vendor
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-600">
                      {req.fromName ? `${req.fromName} <${req.fromEmail}>` : req.fromEmail}
                    </p>
                    {req.title && (
                      <p className="mt-0.5 text-xs text-gray-500">{req.title}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      {(req.hourlyRateMin || req.hourlyRateMax || req.rateText) && (
                        <span className="flex items-center gap-1">
                          <CurrencyDollarIcon className="h-3.5 w-3.5" />
                          {formatRate(req.hourlyRateMin, req.hourlyRateMax, req.rateText)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {timeAgo(req.receivedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="text-xs text-gray-500">
                Showing {(pagination.page - 1) * pagination.pageSize + 1}–
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => fetchReqs(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => fetchReqs(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="xl:col-span-1">
          {selectedReq ? (
            <DetailPanel
              req={selectedReq}
              onUpdated={(updated) => {
                setSelectedReq(updated);
                fetchReqs(pagination.page);
                fetchStats();
              }}
              onConverted={(updated) => {
                setSelectedReq(updated);
                fetchReqs(pagination.page);
                fetchStats();
              }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <p className="text-sm text-gray-400">Select a req to view details</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${accent ? 'text-indigo-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      className="rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function DetailPanel({
  req,
  onUpdated,
  onConverted,
}: {
  req: VendorReq;
  onUpdated: (req: VendorReq) => void;
  onConverted: (req: VendorReq) => void;
}) {
  const [markingReviewed, setMarkingReviewed] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleMarkReviewed = async () => {
    setMarkingReviewed(true);
    try {
      const updated = await api.patch<VendorReq>(`/vendor-reqs/${req.id}/status`, { status: 'REVIEWED' });
      onUpdated(updated);
    } catch (err) {
      console.error('Mark reviewed failed:', err);
    } finally {
      setMarkingReviewed(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      const updated = await api.patch<VendorReq>(`/vendor-reqs/${req.id}/status`, { status: 'REJECTED' });
      onUpdated(updated);
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900">{req.subject}</h3>
          <p className="mt-0.5 text-sm text-gray-600 flex items-center gap-1">
            <UserIcon className="h-3.5 w-3.5 shrink-0" />
            {req.fromName ?? req.fromEmail}
          </p>
          <a
            href={`mailto:${req.fromEmail}`}
            className="mt-0.5 flex items-center gap-1 text-xs text-indigo-600 hover:underline"
          >
            <EnvelopeIcon className="h-3 w-3" />
            {req.fromEmail}
          </a>
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
              TYPE_COLORS[req.employmentType] ?? TYPE_COLORS.UNKNOWN
            }`}
          >
            {TYPE_LABELS[req.employmentType] ?? req.employmentType}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
              STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-600'
            }`}
            >
            {req.status}
            </span>
          {req.matchedByDomain && (
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              <CheckBadgeIcon className="h-3 w-3" /> Matched Vendor
            </span>
          )}
        </div>
      </div>

      {/* Extracted fields */}
      <div className="mt-4 space-y-2">
        {req.title && (
          <div className="text-sm">
            <span className="text-gray-500">Title:</span>{' '}
            <span className="font-medium text-gray-900">{req.title}</span>
          </div>
        )}
        {req.location && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPinIcon className="h-4 w-4 text-gray-400" />
            {req.location}
            {req.locationType && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600">
                {req.locationType}
              </span>
            )}
          </div>
        )}
        {(req.hourlyRateMin || req.hourlyRateMax || req.rateText) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
            {formatRate(req.hourlyRateMin, req.hourlyRateMax, req.rateText)}
          </div>
        )}
        {req.duration && (
          <div className="text-sm text-gray-600">Duration: {req.duration}</div>
        )}
        {req.clientHint && (
          <div className="text-sm text-gray-600">Client: {req.clientHint}</div>
        )}
      </div>

      {/* Negative signals */}
      {req.negativeSignals && req.negativeSignals.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5">
          <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">Restrictions</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {req.negativeSignals.map((sig) => (
              <span key={sig} className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                {sig}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {req.skills && req.skills.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {req.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <div className="mt-4">
        <p className="text-xs font-medium text-gray-500 mb-1.5">Description</p>
        <div className="max-h-60 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 leading-relaxed">
          {req.description ?? 'No description extracted.'}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 space-y-2">
        {req.status !== 'CONVERTED' && (
          <>
            {req.status === 'NEW' && (
              <button
                onClick={handleMarkReviewed}
                disabled={markingReviewed}
                className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                {markingReviewed ? 'Updating...' : 'Mark Reviewed'}
              </button>
            )}
            <ConvertToReqForm
              vendorReqId={req.id}
              onConverted={(jobId) => {
                onConverted({
                  ...req,
                  status: 'CONVERTED',
                  convertedToJobId: jobId,
                  convertedAt: new Date().toISOString(),
                });
              }}
            />
            <button
              onClick={handleReject}
              disabled={rejecting || req.status === 'REJECTED'}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {rejecting ? 'Rejecting...' : 'Reject'}
            </button>
          </>
        )}
        {req.status === 'CONVERTED' && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-2.5 text-center">
            <p className="text-xs font-semibold text-green-700">Converted to internal req</p>
            {req.convertedAt && (
              <p className="text-[10px] text-green-600">{timeAgo(req.convertedAt)}</p>
            )}
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-[10px] text-gray-400">
        Received {timeAgo(req.receivedAt)}
      </p>
    </div>
  );
}

function ConvertToReqForm({
  vendorReqId,
  onConverted,
}: {
  vendorReqId: string;
  onConverted: (jobId: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [pod, setPod] = useState('');
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<Array<{ id: string; companyName: string }>>([]);

  useEffect(() => {
    if (showForm && vendors.length === 0) {
      api.get<Array<{ id: string; companyName: string }>>('/vendors')
        .then(setVendors)
        .catch(() => {});
    }
  }, [showForm, vendors.length]);

  const handleConvert = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const result = await api.post<{ job: { id: string } }>(`/vendor-reqs/${vendorReqId}/convert`, {
        vendorId,
        pod: pod || undefined,
      });
      onConverted(result.job.id);
      setShowForm(false);
    } catch (err) {
      console.error('Convert failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition"
      >
        Convert to Internal Req
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
      <p className="text-xs font-semibold text-emerald-700">Convert to Internal Req</p>
      <select
        value={vendorId}
        onChange={(e) => setVendorId((e.target as HTMLSelectElement).value)}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
      >
        <option value="">Select vendor...</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>{v.companyName}</option>
        ))}
      </select>
      <select
        value={pod}
        onChange={(e) => setPod((e.target as HTMLSelectElement).value)}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
      >
        <option value="">Select pod (optional)...</option>
        <option value="SWE">SWE</option>
        <option value="CLOUD_DEVOPS">Cloud/DevOps</option>
        <option value="DATA">Data</option>
        <option value="CYBER">Cyber</option>
      </select>
      <div className="flex gap-2">
        <button
          onClick={handleConvert}
          disabled={!vendorId || loading}
          className="flex-1 rounded bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? 'Converting...' : 'Create Req'}
        </button>
        <button
          onClick={() => setShowForm(false)}
          className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
