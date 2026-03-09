'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  RocketLaunchIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  SparklesIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  UserIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

interface QueueItem {
  id: string;
  reqTitle: string;
  reqLocation: string | null;
  reqRate: string | null;
  reqSkills: string[];
  reqSource: string;
  vendorName: string | null;
  vendorDomain: string | null;
  vendorTrustScore: number | null;
  contactEmail: string | null;
  contactName: string | null;
  consultantName: string;
  consultantSkills: string[];
  matchScore: number;
  matchReasons: string[];
  marginEstimate: number | null;
  status: string;
  createdAt: string;
  expiresAt: string;
}

interface QueueStats {
  queued: number;
  approved: number;
  rejected: number;
  sent: number;
  expired: number;
  total: number;
}

function MatchBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-green-100 text-green-700' :
    score >= 50 ? 'bg-yellow-100 text-yellow-700' :
    'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${color}`}>
      {score}pts
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    JSEARCH: 'bg-blue-100 text-blue-700',
    CORPTOCORP: 'bg-purple-100 text-purple-700',
    EMAIL: 'bg-gray-100 text-gray-600',
  };
  const labels: Record<string, string> = {
    JSEARCH: 'JSearch',
    CORPTOCORP: 'C2C Board',
    EMAIL: 'Email',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[source] || 'bg-gray-100 text-gray-600'}`}>
      {labels[source] || source}
    </span>
  );
}

export default function AutoSubmitPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<string>('QUEUED');

  const loadData = useCallback(async () => {
    try {
      const [q, s] = await Promise.all([
        api.get<QueueItem[]>(`/auto-submit/queue?status=${filter}&limit=50`),
        api.get<QueueStats>('/auto-submit/stats'),
      ]);
      setQueue(q);
      setStats(s);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === queue.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(queue.map((q) => q.id)));
    }
  };

  const handleApprove = async () => {
    if (selected.size === 0) return;
    setProcessing(true);
    try {
      await api.post('/auto-submit/approve', { itemIds: Array.from(selected) });
      setSelected(new Set());
      await loadData();
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (selected.size === 0) return;
    setProcessing(true);
    try {
      await api.post('/auto-submit/reject', { itemIds: Array.from(selected) });
      setSelected(new Set());
      await loadData();
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post('/auto-submit/generate');
      await loadData();
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auto-Submit Queue"
        subtitle="AI-matched submissions ready for 1-click approval"
        icon={RocketLaunchIcon}
      />

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Queued', value: stats.queued, color: 'text-amber-600 bg-amber-50', filterVal: 'QUEUED' },
            { label: 'Approved', value: stats.approved, color: 'text-blue-600 bg-blue-50', filterVal: 'APPROVED' },
            { label: 'Sent', value: stats.sent, color: 'text-green-600 bg-green-50', filterVal: 'SENT' },
            { label: 'Rejected', value: stats.rejected, color: 'text-red-600 bg-red-50', filterVal: 'REJECTED' },
            { label: 'Expired', value: stats.expired, color: 'text-gray-500 bg-gray-50', filterVal: 'EXPIRED' },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => setFilter(s.filterVal)}
              className={`rounded-xl p-4 text-left transition-all ${filter === s.filterVal ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:shadow-sm'} ${s.color}`}
            >
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-medium uppercase tracking-wide opacity-70">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between rounded-xl bg-white px-5 py-3 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={selectAll}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            {selected.size === queue.length && queue.length > 0 ? 'Deselect All' : `Select All (${queue.length})`}
          </button>
          {selected.size > 0 && (
            <span className="text-xs text-gray-500">{selected.size} selected</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            <BoltIcon className="h-3.5 w-3.5" />
            {generating ? 'Generating...' : 'Generate Queue'}
          </button>
          <button
            onClick={handleReject}
            disabled={selected.size === 0 || processing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
            Reject ({selected.size})
          </button>
          <button
            onClick={handleApprove}
            disabled={selected.size === 0 || processing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 shadow-sm"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            {processing ? 'Sending...' : `Approve & Send (${selected.size})`}
          </button>
        </div>
      </div>

      {/* Queue items */}
      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white py-16 shadow-sm border border-gray-100">
          <RocketLaunchIcon className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">
            {filter === 'QUEUED' ? 'No items in queue. Click "Generate Queue" to match consultants to fresh reqs.' : `No ${filter.toLowerCase()} items in the last 7 days.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((item) => {
            const isExpanded = expandedId === item.id;
            const isSelected = selected.has(item.id);
            return (
              <div
                key={item.id}
                className={`rounded-xl bg-white border transition-all ${isSelected ? 'border-indigo-300 ring-1 ring-indigo-200 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {filter === 'QUEUED' && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  )}

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate text-sm">{item.reqTitle}</span>
                      <SourceBadge source={item.reqSource} />
                      <MatchBadge score={item.matchScore} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {item.consultantName}
                      </span>
                      {item.reqLocation && (
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="h-3 w-3" />
                          {item.reqLocation}
                        </span>
                      )}
                      {item.reqRate && (
                        <span className="flex items-center gap-1">
                          <CurrencyDollarIcon className="h-3 w-3" />
                          {item.reqRate}
                        </span>
                      )}
                      {item.vendorName && (
                        <span className="flex items-center gap-1">
                          <ShieldCheckIcon className="h-3 w-3" />
                          {item.vendorName}
                          {item.vendorTrustScore ? ` (${Math.round(item.vendorTrustScore)})` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {item.marginEstimate != null && (
                    <div className={`text-right text-xs font-semibold ${item.marginEstimate >= 10 ? 'text-green-600' : item.marginEstimate >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      ${item.marginEstimate}/hr
                      <span className="block text-[10px] font-normal text-gray-400">margin est.</span>
                    </div>
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-50 bg-gray-50/50 px-4 py-3 space-y-3">
                    {/* Match reasons */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Match Reasons</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(item.matchReasons as string[]).map((r, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-medium text-indigo-700">
                            <SparklesIcon className="h-3 w-3" />
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Skills comparison */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Req Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {(item.reqSkills as string[]).slice(0, 10).map((s, i) => (
                            <span key={i} className="rounded bg-white px-1.5 py-0.5 text-[10px] text-gray-700 border border-gray-200">{s}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Consultant Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {(item.consultantSkills as string[]).slice(0, 10).map((s, i) => (
                            <span key={i} className="rounded bg-white px-1.5 py-0.5 text-[10px] text-gray-700 border border-gray-200">{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Contact info */}
                    <div className="flex items-center gap-6 text-xs text-gray-600">
                      {item.contactName && <span>Contact: {item.contactName}</span>}
                      {item.contactEmail && (
                        <a
                          href={item.contactEmail.startsWith('http') ? item.contactEmail : `mailto:${item.contactEmail}`}
                          target={item.contactEmail.startsWith('http') ? '_blank' : undefined}
                          rel={item.contactEmail.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="text-indigo-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.contactEmail.startsWith('http') ? 'View Job Posting' : item.contactEmail}
                        </a>
                      )}
                      <span className="text-gray-400">
                        Expires: {new Date(item.expiresAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
