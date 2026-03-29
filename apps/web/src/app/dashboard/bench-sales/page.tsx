'use client';

import { useState, lazy, Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { ClickableMetric, StaticDrillDownModal } from '@/components/drill-down-modal';
import {
  UsersIcon,
  BriefcaseIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

/* ── Lazy-load tab content from existing pages ───────────────────── */
const CurrentBenchPanel = lazy(() => import('./_panels/current-bench-panel'));
const ConsultantsPanel = lazy(() => import('./_panels/consultants-panel'));
const JobsPanel = lazy(() => import('./_panels/jobs-panel'));

/* ── Tab definitions ─────────────────────────────────────────────── */
const TABS = [
  { key: 'current-bench', label: 'Current Bench', icon: SparklesIcon },
  { key: 'consultants', label: 'Consultants', icon: UsersIcon },
  { key: 'jobs', label: 'Jobs', icon: BriefcaseIcon },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */

export default function BenchSalesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('current-bench');
  const [selectedRow, setSelectedRow] = useState<any>(null);

  return (
    <>
      <PageHeader
        title="Bench Sales"
        description="Manage consultants and job opportunities"
      />

      {/* ── Tab Bar ──────────────────────────────────────────── */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`group inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <tab.icon
                  className={`h-5 w-5 ${
                    isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab Content ─────────────────────────────────────── */}
      <Suspense fallback={<TabSpinner />}>
        {activeTab === 'current-bench' && <CurrentBenchPanel />}
        {activeTab === 'consultants' && <ConsultantsPanel />}
        {activeTab === 'jobs' && <JobsPanel />}
      </Suspense>

      {selectedRow && (
        <StaticDrillDownModal
          title={selectedRow.name || selectedRow.title || 'Details'}
          rows={[selectedRow]}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </>
  );
}
