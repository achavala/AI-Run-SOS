'use client';

import { useState, lazy, Suspense } from 'react';
import {
  BriefcaseIcon,
  EnvelopeIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

/* ── Lazy-load existing page components ──────────────────────────── */
const JobsPage = lazy(() => import('../../jobs/page'));
const VendorReqsPage = lazy(() => import('../../vendor-reqs/page'));
const MarketJobsPage = lazy(() => import('../../market-jobs/page'));

/* ── Sub-tab definitions ─────────────────────────────────────────── */
const SUB_TABS = [
  { key: 'internal', label: 'Internal Jobs', icon: BriefcaseIcon },
  { key: 'vendor-reqs', label: 'Vendor Requirements', icon: EnvelopeIcon },
  { key: 'market', label: 'Market Jobs', icon: GlobeAltIcon },
] as const;

type SubTabKey = (typeof SUB_TABS)[number]['key'];

function SubTabSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );
}

export default function JobsPanel() {
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('internal');

  return (
    <>
      {/* ── Sub-tab pills ────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap gap-2">
        {SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <tab.icon className={`h-4 w-4 ${isActive ? 'text-indigo-200' : 'text-gray-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Sub-tab content ──────────────────────────────────── */}
      <Suspense fallback={<SubTabSpinner />}>
        {activeSubTab === 'internal' && <JobsPage />}
        {activeSubTab === 'vendor-reqs' && <VendorReqsPage />}
        {activeSubTab === 'market' && <MarketJobsPage />}
      </Suspense>
    </>
  );
}
