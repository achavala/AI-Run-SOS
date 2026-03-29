'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { XMarkIcon, ArrowPathIcon, ExclamationTriangleIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';

function renderCellValue(val: any): string {
  if (val == null) return '—';
  if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))) {
    return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (Array.isArray(val)) return val.slice(0, 6).join(', ') || '—';
  if (typeof val === 'object') {
    if (val.firstName) return `${val.firstName} ${val.lastName || ''}`.trim();
    if (val.companyName) return val.companyName;
    if (val.title && typeof val.title === 'string') return val.title;
    if (val.consultant) return renderCellValue(val.consultant);
    if (val.job) return renderCellValue(val.job);
    if (val.vendor) return renderCellValue(val.vendor);
    return JSON.stringify(val).slice(0, 80);
  }
  if (typeof val === 'number') return val.toLocaleString();
  return String(val);
}

function renderFullValue(val: any): React.ReactNode {
  if (val == null) return <span className="text-gray-400">—</span>;
  if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))) {
    return new Date(val).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-gray-400">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {val.map((v, i) => (
          <span key={i} className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">{String(v)}</span>
        ))}
      </div>
    );
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val).filter(([k]) => k !== '__typename');
    return (
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-[10px] text-gray-400 min-w-[60px] capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}:</span>
            <span className="text-xs text-gray-700">{renderCellValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (typeof val === 'boolean') return val ? <span className="text-green-600 font-medium">Yes</span> : <span className="text-gray-400">No</span>;
  if (typeof val === 'number') return <span className="font-mono">{val.toLocaleString()}</span>;
  return <span className="break-words">{String(val)}</span>;
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-800',
  INTERVIEWING: 'bg-yellow-100 text-yellow-800',
  OFFERED: 'bg-green-100 text-green-800',
  ACCEPTED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  WITHDRAWN: 'bg-gray-200 text-gray-700',
  CLOSED: 'bg-gray-200 text-gray-700',
  DRAFT: 'bg-slate-100 text-slate-700',
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-200 text-gray-600',
  SCHEDULED: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  QUEUED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  SENT: 'bg-emerald-100 text-emerald-800',
  EXPIRED: 'bg-gray-200 text-gray-600',
  SUBMISSION_READY: 'bg-green-100 text-green-800',
  VERIFIED: 'bg-blue-100 text-blue-800',
  NEW: 'bg-indigo-100 text-indigo-800',
  DOCS_PENDING: 'bg-yellow-100 text-yellow-800',
  ON_ASSIGNMENT: 'bg-purple-100 text-purple-800',
  EXTENDED: 'bg-yellow-100 text-yellow-800',
  PENDING: 'bg-amber-100 text-amber-800',
};

/* Record Detail View — shows all fields of a single record */
function RecordDetailView({ record, onBack }: { record: any; onBack: () => void }) {
  const entries = Object.entries(record).filter(([k]) => k !== '__typename' && k !== 'id');
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mb-4 transition-colors">
        <ChevronLeftIcon className="h-4 w-4" /> Back to list
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {entries.map(([key, val]) => (
          <div key={key} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
              {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
            </p>
            <div className="text-sm text-gray-800">{renderFullValue(val)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Static drill-down: when we already have the data */
export function StaticDrillDownModal({
  title,
  description,
  rows,
  onClose,
}: {
  title: string;
  description?: string;
  rows: any[];
  onClose: () => void;
}) {
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-12 px-4" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[82vh] bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description && <p className="text-xs text-gray-500">{description}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 transition-colors"><XMarkIcon className="h-5 w-5 text-gray-600" /></button>
        </div>
        <div className="overflow-auto max-h-[68vh] px-6 py-4">
          {selectedRecord ? (
            <RecordDetailView record={selectedRecord} onBack={() => setSelectedRecord(null)} />
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">No records found</p>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3">{rows.length} records — click any row for full details</p>
              <DrillDataTable rows={rows} onRowClick={setSelectedRecord} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* API drill-down: fetches from /ai-agents/drilldown or a custom endpoint */
export function ApiDrillDownModal({
  endpoint,
  title,
  onClose,
}: {
  endpoint: string;
  title?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(endpoint)
      .then((res: any) => setData(res))
      .catch((e: any) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [endpoint]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-12 px-4" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[82vh] bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{data?.title || title || 'Details'}</h2>
            {data?.description && <p className="text-xs text-gray-500">{data.description}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 transition-colors"><XMarkIcon className="h-5 w-5 text-gray-600" /></button>
        </div>
        <div className="overflow-auto max-h-[68vh] px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-indigo-500" />
              <span className="ml-2 text-sm text-gray-500">Loading...</span>
            </div>
          )}
          {!loading && error && (
            <div className="text-center py-12">
              <ExclamationTriangleIcon className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="text-sm text-gray-600 mt-2">{error}</p>
            </div>
          )}
          {!loading && !error && data?.rows && (
            selectedRecord ? (
              <RecordDetailView record={selectedRecord} onBack={() => setSelectedRecord(null)} />
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  {data.rows.length} records{data.rows.length > 0 && ' — click any row for full details'}
                </p>
                {data.rows.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-12">No records found</p>
                ) : (
                  <DrillDataTable rows={data.rows} onRowClick={setSelectedRecord} />
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* Shared data table renderer with clickable rows */
function DrillDataTable({ rows, onRowClick }: { rows: any[]; onRowClick?: (row: any) => void }) {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]).filter(k => k !== 'id' && k !== '__typename');

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b bg-gray-50 sticky top-0">
          <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">#</th>
          {keys.map(k => (
            <th key={k} className="px-3 py-2 text-left text-xs text-gray-500 font-medium capitalize">
              {k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr
            key={row.id || idx}
            onClick={() => onRowClick?.(row)}
            className="border-b border-gray-50 hover:bg-indigo-50 transition-colors cursor-pointer group"
          >
            <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
            {keys.map(key => {
              const val = row[key];
              const isStatus = key.toLowerCase() === 'status' || key.toLowerCase() === 'readiness';
              const isScore = /score|trust|quality|rating|margin/i.test(key);
              return (
                <td key={key} className="px-3 py-2 text-xs text-gray-700 max-w-[220px] truncate group-hover:text-indigo-900">
                  {isStatus && typeof val === 'string' ? (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[val] || 'bg-gray-100 text-gray-600'}`}>{val}</span>
                  ) : isScore && val != null ? (
                    <span className={`font-medium ${Number(val) >= 60 ? 'text-green-600' : Number(val) >= 30 ? 'text-yellow-600' : 'text-gray-500'}`}>
                      {Number(val).toFixed(1)}
                    </span>
                  ) : (
                    renderCellValue(val)
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* Clickable metric card wrapper */
export function ClickableMetric({
  children,
  metric,
  endpoint,
  title,
  staticData,
}: {
  children: React.ReactNode;
  metric?: string;
  endpoint?: string;
  title?: string;
  staticData?: { title: string; rows: any[] };
}) {
  const [open, setOpen] = useState(false);
  const resolvedEndpoint = endpoint || (metric ? `/ai-agents/drilldown?metric=${encodeURIComponent(metric)}&limit=100` : '');

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="cursor-pointer hover:shadow-md hover:border-indigo-300 hover:ring-1 hover:ring-indigo-200 transition-all relative group"
        title="Click to view details"
      >
        {children}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-400 scale-x-0 group-hover:scale-x-100 transition-transform rounded-b-xl" />
      </div>
      {open && staticData && <StaticDrillDownModal title={staticData.title} rows={staticData.rows} onClose={() => setOpen(false)} />}
      {open && !staticData && resolvedEndpoint && <ApiDrillDownModal endpoint={resolvedEndpoint} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}
