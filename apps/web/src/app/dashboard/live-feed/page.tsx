'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import {
  ArrowPathIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InboxArrowDownIcon,
  ArrowTopRightOnSquareIcon,
  UserIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  StarIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  PhoneIcon,
  ClipboardDocumentIcon,
  FunnelIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const SOURCE_COLORS: Record<string, string> = {
  'Email Intel': 'bg-violet-100 text-violet-700 border-violet-200',
  JSEARCH: 'bg-blue-100 text-blue-700 border-blue-200',
  JSearch: 'bg-blue-100 text-blue-700 border-blue-200',
  DICE: 'bg-green-100 text-green-700 border-green-200',
  Dice: 'bg-green-100 text-green-700 border-green-200',
  ARBEITNOW: 'bg-orange-100 text-orange-700 border-orange-200',
  Arbeitnow: 'bg-orange-100 text-orange-700 border-orange-200',
  REMOTEOK: 'bg-teal-100 text-teal-700 border-teal-200',
  RemoteOK: 'bg-teal-100 text-teal-700 border-teal-200',
  GREENHOUSE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  LEVER: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  LINKEDIN: 'bg-sky-100 text-sky-700 border-sky-200',
  LinkedIn: 'bg-sky-100 text-sky-700 border-sky-200',
  OTHER: 'bg-gray-100 text-gray-700 border-gray-200',
};

const VENDOR_TIER_COLORS: Record<string, string> = {
  prime_like: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  direct_like: 'bg-blue-100 text-blue-800 border-blue-300',
  reputable_staffing: 'bg-violet-100 text-violet-800 border-violet-300',
  generic: 'bg-gray-100 text-gray-700 border-gray-200',
  low_confidence: 'bg-gray-50 text-gray-500 border-gray-200',
};

const VENDOR_TIER_LABELS: Record<string, string> = {
  prime_like: 'Prime Vendor',
  direct_like: 'Direct Vendor',
  reputable_staffing: 'Staffing Vendor',
  generic: 'Generic',
  low_confidence: 'Unverified',
};

const LIKELIHOOD_COLORS: Record<string, string> = {
  high: 'text-emerald-700 bg-emerald-50',
  medium: 'text-blue-700 bg-blue-50',
  low: 'text-amber-700 bg-amber-50',
  unlikely: 'text-gray-500 bg-gray-50',
};

const TIER_COLORS: Record<string, string> = {
  MEGA: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white',
  ELITE: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white',
  PREMIUM: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
  HIGH: 'bg-emerald-100 text-emerald-800',
  STANDARD: 'bg-gray-100 text-gray-700',
};

const TIER_LABELS: Record<string, string> = {
  MEGA: '$400K+ Base',
  ELITE: '$300K–$400K Base',
  PREMIUM: '$250K–$300K Base',
  HIGH: '$200K–$250K Base',
  STANDARD: '< $200K Base',
};

const EMP_COLORS: Record<string, string> = {
  C2C: 'bg-emerald-100 text-emerald-800',
  W2: 'bg-blue-100 text-blue-800',
  CONTRACT: 'bg-amber-100 text-amber-800',
  C2H: 'bg-purple-100 text-purple-800',
  CONTRACTOR: 'bg-amber-100 text-amber-800',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmt(n: number | undefined | null): string {
  if (n == null) return '0';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

function emailUsername(email: string): string {
  if (!email) return '';
  return email.split('@')[0] || email;
}

type EmpFilter = 'ALL' | 'C2C' | 'W2' | 'CONTRACT' | 'C2H';
type FeedTab = 'linkedin' | 'email' | 'boards' | 'highpaid';
type CompTier = 'ALL' | 'MEGA' | 'ELITE' | 'PREMIUM' | 'HIGH';
type LinkedInSort = 'best' | 'newest' | 'confidence' | 'rate' | 'prime' | 'direct';
type VendorTierFilter = 'ALL' | 'prime_like' | 'direct_like' | 'reputable_staffing' | 'generic';
type PostedFilter = 'ALL' | '6h' | '24h' | '72h' | '7d';
type ContactFilter = 'ALL' | 'has_contact' | 'has_email';

export default function LiveFeedPage() {
  const [data, setData] = useState<any>(null);
  const [highPaidData, setHighPaidData] = useState<any>(null);
  const [linkedinData, setLinkedinData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [highPaidLoading, setHighPaidLoading] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [empFilter, setEmpFilter] = useState<EmpFilter>('ALL');
  const [compTierFilter, setCompTierFilter] = useState<CompTier>('ALL');
  const [activeTab, setActiveTab] = useState<FeedTab>('linkedin');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  // LinkedIn-specific filters
  const [linkedinSort, setLinkedinSort] = useState<LinkedInSort>('best');
  const [vendorTierFilter, setVendorTierFilter] = useState<VendorTierFilter>('ALL');
  const [postedFilter, setPostedFilter] = useState<PostedFilter>('ALL');
  const [contactFilter, setContactFilter] = useState<ContactFilter>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [showLinkedinFilters, setShowLinkedinFilters] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [nextRefreshIn, setNextRefreshIn] = useState(60);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async (bustCache = false) => {
    setLoading(true);
    try {
      const qs = bustCache ? '&bustCache=1' : '';
      const d = await api.get(`/analytics/live-feed?hours=24&limit=500${qs}`);
      setData(d);
      setLastRefresh(new Date());
      setNextRefreshIn(60);
    } catch (err) {
      console.error('Failed to load live feed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHighPaid = useCallback(async (bustCache = false) => {
    setHighPaidLoading(true);
    try {
      const qs = bustCache ? '&bustCache=1' : '';
      const d = await api.get(`/analytics/high-paid-feed?minSalary=200000&limit=300${qs}`);
      setHighPaidData(d);
    } catch (err) {
      console.error('Failed to load high-paid feed', err);
    } finally {
      setHighPaidLoading(false);
    }
  }, []);

  const loadLinkedin = useCallback(async (bustCache = false) => {
    setLinkedinLoading(true);
    try {
      const qs = bustCache ? '?bustCache=1' : '';
      const d = await api.get(`/analytics/linkedin-feed${qs}`);
      setLinkedinData(d);
    } catch (err) {
      console.error('Failed to load LinkedIn feed', err);
    } finally {
      setLinkedinLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setHighPaidLoading(true);
    setLinkedinLoading(true);
    // Fire FAANG crawl in background — don't block the UI refresh.
    // The crawl hits 30+ career boards and takes 30-60s; waiting for it
    // makes the spinner hang and returns stale data if the crawl fails.
    api.post('/analytics/refresh-all-feeds').catch(() => {});
    await Promise.all([load(true), loadHighPaid(true), loadLinkedin(true)]);
    setLastRefresh(new Date());
    setNextRefreshIn(60);
  }, [load, loadHighPaid, loadLinkedin]);

  useEffect(() => {
    load();
    loadHighPaid();
    loadLinkedin();
    timerRef.current = setInterval(() => { refreshAll(); }, 60 * 60 * 1000);
    countdownRef.current = setInterval(() => {
      setNextRefreshIn(prev => (prev <= 1 ? 60 : prev - 1));
    }, 60 * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [load, loadHighPaid, loadLinkedin, refreshAll]);

  const allJobs: any[] = data?.jobs || [];
  const highPaidJobs: any[] = highPaidData?.jobs || [];
  const linkedinJobs: any[] = linkedinData?.jobs || [];

  const emailJobs = useMemo(() => allJobs.filter((j: any) => j.source === 'Email Intel'), [allJobs]);
  const boardJobs = useMemo(() => allJobs.filter((j: any) => j.source !== 'Email Intel'), [allJobs]);

  const currentPool = activeTab === 'linkedin' ? linkedinJobs :
                      activeTab === 'email' ? emailJobs :
                      activeTab === 'boards' ? boardJobs : highPaidJobs;

  const filtered = useMemo(() => {
    let pool = currentPool.filter((j: any) => {
      if (activeTab !== 'highpaid' && activeTab !== 'linkedin' && empFilter !== 'ALL' && j.employmentType !== empFilter) return false;
      if (activeTab === 'highpaid' && compTierFilter !== 'ALL' && j.tier !== compTierFilter) return false;
      // LinkedIn-specific filters
      if (activeTab === 'linkedin') {
        if (empFilter !== 'ALL' && j.employmentType !== empFilter) return false;
        if (vendorTierFilter !== 'ALL' && j.vendorQualityTier !== vendorTierFilter) return false;
        if (contactFilter === 'has_contact' && !j.contactAvailable) return false;
        if (contactFilter === 'has_email' && !j.recruiterEmail) return false;
        if (postedFilter !== 'ALL') {
          const maxHours = postedFilter === '6h' ? 6 : postedFilter === '24h' ? 24 : postedFilter === '72h' ? 72 : 168;
          if ((j.freshnessHours || 9999) > maxHours) return false;
        }
        if (locationFilter !== 'ALL') {
          const loc = (j.locationType || '').toUpperCase();
          if (locationFilter === 'REMOTE' && loc !== 'REMOTE') return false;
          if (locationFilter === 'HYBRID' && loc !== 'HYBRID') return false;
          if (locationFilter === 'ONSITE' && loc !== 'ONSITE') return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          (j.title || '').toLowerCase().includes(q) ||
          (j.company || '').toLowerCase().includes(q) ||
          (j.location || '').toLowerCase().includes(q) ||
          (j.receivedByEmail || '').toLowerCase().includes(q) ||
          (j.fromEmail || '').toLowerCase().includes(q) ||
          (j.recruiterName || '').toLowerCase().includes(q) ||
          (j.recruiterEmail || '').toLowerCase().includes(q) ||
          (j.skills || []).some((s: string) => s.toLowerCase().includes(q))
        );
      }
      return true;
    });
    // LinkedIn sorting
    if (activeTab === 'linkedin' && linkedinSort !== 'best') {
      pool = [...pool].sort((a, b) => {
        if (linkedinSort === 'newest') return (b.freshnessHours === a.freshnessHours ? 0 : (a.freshnessHours || 9999) - (b.freshnessHours || 9999));
        if (linkedinSort === 'confidence') return (b.linkedinScore || 0) - (a.linkedinScore || 0);
        if (linkedinSort === 'rate') return (b.annualRate || 0) - (a.annualRate || 0);
        if (linkedinSort === 'prime') return (b.vendorConfidenceScore || 0) - (a.vendorConfidenceScore || 0);
        if (linkedinSort === 'direct') {
          const aD = a.vendorQualityTier === 'direct_like' ? 1 : 0;
          const bD = b.vendorQualityTier === 'direct_like' ? 1 : 0;
          return bD - aD || (b.vendorConfidenceScore || 0) - (a.vendorConfidenceScore || 0);
        }
        return 0;
      });
    }
    return pool;
  }, [currentPool, empFilter, compTierFilter, search, activeTab, vendorTierFilter, postedFilter, contactFilter, locationFilter, linkedinSort]);

  const stats: any[] = data?.stats || [];
  const c2cCount = stats.find((s: any) => s.type === 'C2C')?.count || 0;
  const w2Count = stats.find((s: any) => s.type === 'W2')?.count || 0;
  const contractCount = stats.find((s: any) => s.type === 'CONTRACT')?.count || 0;
  const c2hCount = stats.find((s: any) => s.type === 'C2H')?.count || 0;

  const boardSourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    boardJobs.forEach((j: any) => {
      const src = j.source || 'Unknown';
      counts[src] = (counts[src] || 0) + 1;
    });
    return counts;
  }, [boardJobs]);

  const emailMailboxCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    emailJobs.forEach((j: any) => {
      const mb = j.receivedByEmail || 'Unknown';
      counts[mb] = (counts[mb] || 0) + 1;
    });
    return counts;
  }, [emailJobs]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Live Job Feed"
        description="C2C / W2 / Contract openings from the last 24 hours — all sources combined"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <ClockIcon className="h-3.5 w-3.5" />
              <span>Refreshes in {nextRefreshIn}m</span>
            </div>
            <button
              onClick={async () => {
                setExtracting(true);
                setExtractResult(null);
                try {
                  const res: any = await api.post('/mail-intel/re-extract');
                  setExtractResult(`Extracted ${res.signalsCreated} new signals from ${res.emailsScanned} emails`);
                  await Promise.all([load(true), loadHighPaid(true), loadLinkedin(true)]);
                } catch {
                  setExtractResult('Extraction failed');
                } finally {
                  setExtracting(false);
                }
              }}
              disabled={extracting}
              className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              <InboxArrowDownIcon className={`h-3.5 w-3.5 ${extracting ? 'animate-pulse' : ''}`} />
              {extracting ? 'Extracting...' : 'Re-Extract Emails'}
            </button>
            <button
              onClick={refreshAll}
              disabled={loading || highPaidLoading || linkedinLoading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-3.5 w-3.5 ${loading || highPaidLoading || linkedinLoading ? 'animate-spin' : ''}`} />
              Refresh Now
            </button>
          </div>
        }
      />

      {extractResult && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-700 flex items-center justify-between">
          <span>{extractResult}</span>
          <button onClick={() => setExtractResult(null)} className="text-violet-400 hover:text-violet-600 text-xs">dismiss</button>
        </div>
      )}

      {/* Stats Bar — LinkedIn */}
      {activeTab === 'linkedin' && linkedinData?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
          <div className="rounded-xl border-2 border-sky-200 bg-sky-50 p-3 text-center">
            <p className="text-2xl font-bold text-sky-700">{linkedinData.summary.totalJobs}</p>
            <p className="text-[10px] font-medium text-sky-600">Total LinkedIn</p>
          </div>
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{linkedinData.summary.highConfidence}</p>
            <p className="text-[10px] font-medium text-emerald-600">High Confidence</p>
          </div>
          <button
            onClick={() => setVendorTierFilter(vendorTierFilter === 'prime_like' ? 'ALL' : 'prime_like')}
            className={`rounded-xl border-2 p-3 text-center transition-all ${vendorTierFilter === 'prime_like' ? 'border-emerald-400 ring-2 ring-emerald-200 bg-emerald-50' : 'border-emerald-200 bg-emerald-50 hover:border-emerald-300'}`}
          >
            <p className="text-2xl font-bold text-emerald-700">{linkedinData.summary.primeVendorLikely}</p>
            <p className="text-[10px] font-medium text-emerald-600">Prime Likely</p>
          </button>
          <button
            onClick={() => setVendorTierFilter(vendorTierFilter === 'direct_like' ? 'ALL' : 'direct_like')}
            className={`rounded-xl border-2 p-3 text-center transition-all ${vendorTierFilter === 'direct_like' ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50' : 'border-blue-200 bg-blue-50 hover:border-blue-300'}`}
          >
            <p className="text-2xl font-bold text-blue-700">{linkedinData.summary.directVendorLikely}</p>
            <p className="text-[10px] font-medium text-blue-600">Direct Likely</p>
          </button>
          <button
            onClick={() => setContactFilter(contactFilter === 'has_contact' ? 'ALL' : 'has_contact')}
            className={`rounded-xl border-2 p-3 text-center transition-all ${contactFilter === 'has_contact' ? 'border-violet-400 ring-2 ring-violet-200 bg-violet-50' : 'border-violet-200 bg-violet-50 hover:border-violet-300'}`}
          >
            <p className="text-2xl font-bold text-violet-700">{linkedinData.summary.withContact}</p>
            <p className="text-[10px] font-medium text-violet-600">With Contact</p>
          </button>
          <button
            onClick={() => setPostedFilter(postedFilter === '24h' ? 'ALL' : '24h')}
            className={`rounded-xl border-2 p-3 text-center transition-all ${postedFilter === '24h' ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50' : 'border-amber-200 bg-amber-50 hover:border-amber-300'}`}
          >
            <p className="text-2xl font-bold text-amber-700">{linkedinData.summary.freshUnder24h}</p>
            <p className="text-[10px] font-medium text-amber-600">Fresh &lt;24h</p>
          </button>
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{fmt(filtered.length)}</p>
            <p className="text-[10px] text-gray-500 font-medium">Showing</p>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {activeTab === 'email' || activeTab === 'boards' ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            onClick={() => setEmpFilter(empFilter === 'C2C' ? 'ALL' : 'C2C')}
            className={`rounded-xl border-2 p-3 text-center transition-all ${
              empFilter === 'C2C'
                ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                : 'border-emerald-200 bg-emerald-50 hover:border-emerald-300'
            }`}
          >
            <p className="text-2xl font-bold text-emerald-700">{fmt(c2cCount)}</p>
            <p className="text-[10px] font-medium text-emerald-600">C2C</p>
          </button>
          <button
            onClick={() => setEmpFilter(empFilter === 'W2' ? 'ALL' : 'W2')}
            className={`rounded-xl border-2 p-3 text-center transition-all ${
              empFilter === 'W2'
                ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                : 'border-blue-200 bg-blue-50 hover:border-blue-300'
            }`}
          >
            <p className="text-2xl font-bold text-blue-700">{fmt(w2Count)}</p>
            <p className="text-[10px] font-medium text-blue-600">W2</p>
          </button>
          <button
            onClick={() => setEmpFilter(empFilter === 'CONTRACT' ? 'ALL' : 'CONTRACT')}
            className={`rounded-xl border-2 p-3 text-center transition-all ${
              empFilter === 'CONTRACT'
                ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                : 'border-amber-200 bg-amber-50 hover:border-amber-300'
            }`}
          >
            <p className="text-2xl font-bold text-amber-700">{fmt(contractCount)}</p>
            <p className="text-[10px] font-medium text-amber-600">Contract</p>
          </button>
          <button
            onClick={() => setEmpFilter(empFilter === 'C2H' ? 'ALL' : 'C2H')}
            className={`rounded-xl border-2 p-3 text-center transition-all ${
              empFilter === 'C2H'
                ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200'
                : 'border-purple-200 bg-purple-50 hover:border-purple-300'
            }`}
          >
            <p className="text-2xl font-bold text-purple-700">{fmt(c2hCount)}</p>
            <p className="text-[10px] font-medium text-purple-600">C2H</p>
          </button>
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{fmt(filtered.length)}</p>
            <p className="text-[10px] text-gray-500 font-medium">Showing</p>
          </div>
        </div>
      ) : activeTab === 'highpaid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {(highPaidData?.compBuckets || []).map((b: any) => {
            const tierKey = b.label.includes('500') ? 'MEGA' : b.label.includes('400') ? 'ELITE' : b.label.includes('300') ? 'PREMIUM' : 'HIGH';
            const isActive = compTierFilter === tierKey;
            const borderColor = tierKey === 'MEGA' ? 'border-yellow-400' : tierKey === 'ELITE' ? 'border-purple-400' : tierKey === 'PREMIUM' ? 'border-blue-400' : 'border-emerald-400';
            const bgColor = tierKey === 'MEGA' ? 'bg-yellow-50' : tierKey === 'ELITE' ? 'bg-purple-50' : tierKey === 'PREMIUM' ? 'bg-blue-50' : 'bg-emerald-50';
            const textColor = tierKey === 'MEGA' ? 'text-yellow-700' : tierKey === 'ELITE' ? 'text-purple-700' : tierKey === 'PREMIUM' ? 'text-blue-700' : 'text-emerald-700';
            return (
              <button
                key={b.label}
                onClick={() => setCompTierFilter(isActive ? 'ALL' : tierKey as CompTier)}
                className={`rounded-xl border-2 p-3 text-center transition-all ${
                  isActive ? `${borderColor} ${bgColor} ring-2 ring-offset-1` : `${borderColor} ${bgColor} hover:ring-1`
                }`}
              >
                <p className={`text-2xl font-bold ${textColor}`}>{b.count}</p>
                <p className={`text-[10px] font-medium ${textColor}`}>{b.label}</p>
              </button>
            );
          })}
          {highPaidData?.avgOpportunityScore > 0 && (
            <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-3 text-center">
              <p className="text-2xl font-bold text-indigo-700">{highPaidData.avgOpportunityScore}</p>
              <p className="text-[10px] font-medium text-indigo-600">Avg Score</p>
            </div>
          )}
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{fmt(filtered.length)}</p>
            <p className="text-[10px] text-gray-500 font-medium">Showing</p>
          </div>
        </div>
      ) : null}

      {/* Main Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
        <button
          onClick={() => { setActiveTab('linkedin'); setExpandedId(null); setVisibleCount(50); setVendorTierFilter('ALL'); setPostedFilter('ALL'); setContactFilter('ALL'); setLocationFilter('ALL'); setLinkedinSort('best'); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'linkedin'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <BriefcaseIcon className="h-4 w-4" />
          LinkedIn
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            activeTab === 'linkedin' ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-700'
          }`}>
            {linkedinJobs.length}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('email'); setExpandedId(null); setVisibleCount(50); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'email'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <EnvelopeIcon className="h-4 w-4" />
          Email Intel
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            activeTab === 'email' ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'
          }`}>
            {emailJobs.length}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('boards'); setExpandedId(null); setVisibleCount(50); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'boards'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <GlobeAltIcon className="h-4 w-4" />
          Job Boards
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            activeTab === 'boards' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
          }`}>
            {boardJobs.length}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('highpaid'); setExpandedId(null); setVisibleCount(50); setCompTierFilter('ALL'); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'highpaid'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <BanknotesIcon className="h-4 w-4" />
          High-Paid
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            activeTab === 'highpaid' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
          }`}>
            {highPaidJobs.length}
          </span>
        </button>
      </div>

      {/* Tab-specific source breakdown */}
      {activeTab === 'linkedin' && linkedinData && (
        <div className="space-y-3">
          {/* Vendor tier + top companies */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(linkedinData.vendorTierDist || {})
              .sort(([, a]: any, [, b]: any) => b - a)
              .map(([tier, count]: any) => (
                <button
                  key={tier}
                  onClick={() => setVendorTierFilter(vendorTierFilter === tier ? 'ALL' : tier as VendorTierFilter)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                    vendorTierFilter === tier ? 'ring-2 ring-offset-1 ' : ''
                  }${VENDOR_TIER_COLORS[tier] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                >
                  <ShieldCheckIcon className="h-3 w-3" />
                  {VENDOR_TIER_LABELS[tier] || tier}: {count}
                </button>
              ))}
          </div>
          {(linkedinData.topCompanies || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(linkedinData.topCompanies as any[]).slice(0, 15).map((c: any) => (
                <span key={c.company} className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                  <BuildingOffice2Icon className="h-3 w-3" />
                  {c.company}: {c.count}
                </span>
              ))}
            </div>
          )}
          {/* Compliance class distribution */}
          {(linkedinData.complianceDist) && Object.keys(linkedinData.complianceDist).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(linkedinData.complianceDist).sort(([,a]: any, [,b]: any) => b - a).map(([cls, count]: any) => (
                <span key={cls} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                  cls === 'FIRST_PARTY_CAREER_SITE' ? 'bg-green-50 text-green-700 border-green-200' :
                  cls === 'LICENSED_PROVIDER' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  cls === 'EMAIL_INTEL_DERIVED' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                  cls === 'MANUAL_IMPORT' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-gray-50 text-gray-600 border-gray-200'
                }`}>
                  {cls.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}: {count}
                </span>
              ))}
            </div>
          )}
          {/* LinkedIn advanced filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowLinkedinFilters(!showLinkedinFilters)}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
            >
              <FunnelIcon className="h-3.5 w-3.5" />
              {showLinkedinFilters ? 'Hide Filters' : 'More Filters'}
            </button>
            <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
              {([['best', 'Best'], ['newest', 'Newest'], ['confidence', 'Score'], ['rate', 'Rate'], ['prime', 'Prime'], ['direct', 'Direct']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setLinkedinSort(val as LinkedInSort)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    linkedinSort === val ? 'bg-sky-600 text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
              {(['ALL', 'C2C', 'W2', 'CONTRACT'] as const).map((f) => (
                <button key={f} onClick={() => setEmpFilter(f as EmpFilter)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${empFilter === f ? 'bg-sky-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                >{f}</button>
              ))}
            </div>
          </div>
          {showLinkedinFilters && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-100 bg-sky-50/50 p-3">
              <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
                <span className="px-2 py-1 text-[10px] text-gray-500 font-medium">Posted:</span>
                {(['ALL', '6h', '24h', '72h', '7d'] as const).map((f) => (
                  <button key={f} onClick={() => setPostedFilter(f)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${postedFilter === f ? 'bg-sky-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >{f === 'ALL' ? 'Any' : `<${f}`}</button>
                ))}
              </div>
              <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
                <span className="px-2 py-1 text-[10px] text-gray-500 font-medium">Location:</span>
                {(['ALL', 'REMOTE', 'HYBRID', 'ONSITE'] as const).map((f) => (
                  <button key={f} onClick={() => setLocationFilter(f)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${locationFilter === f ? 'bg-sky-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >{f === 'ALL' ? 'Any' : f}</button>
                ))}
              </div>
              <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
                <span className="px-2 py-1 text-[10px] text-gray-500 font-medium">Contact:</span>
                {([['ALL', 'Any'], ['has_contact', 'Has Contact'], ['has_email', 'Has Email']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setContactFilter(val as ContactFilter)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${contactFilter === val ? 'bg-sky-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >{label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'email' && Object.keys(emailMailboxCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(emailMailboxCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([mailbox, count]) => (
              <span
                key={mailbox}
                className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700"
              >
                <InboxArrowDownIcon className="h-3 w-3" />
                {emailUsername(mailbox)}: {count}
              </span>
            ))}
        </div>
      )}
      {activeTab === 'boards' && Object.keys(boardSourceCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(boardSourceCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([source, count]) => (
              <span
                key={source}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  SOURCE_COLORS[source] || 'bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                <GlobeAltIcon className="h-3 w-3" />
                {source}: {count}
              </span>
            ))}
        </div>
      )}
      {activeTab === 'highpaid' && (highPaidData?.topCompanies || []).length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {(highPaidData.topCompanies as any[]).slice(0, 20).map((c: any) => (
              <span
                key={c.company}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700"
              >
                <BuildingOffice2Icon className="h-3 w-3" />
                {c.company}: {c.count}
              </span>
            ))}
          </div>
          {highPaidData?.compIntelSummary && (
            <div className="flex flex-wrap gap-3 text-[10px]">
              <span className="inline-flex items-center gap-1 rounded-md bg-green-50 border border-green-200 px-2 py-1 text-green-700 font-medium">
                {highPaidData.compIntelSummary.baseSalaryRoles} verified base salary
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 border border-orange-200 px-2 py-1 text-orange-700 font-medium">
                {highPaidData.compIntelSummary.totalCompRoles} estimated from total comp
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-1 text-indigo-700 font-medium">
                {highPaidData.compIntelSummary.withEquity} with equity mentioned
              </span>
            </div>
          )}
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'linkedin'
              ? 'Search title, company, recruiter, location, skills...'
              : activeTab === 'highpaid'
                ? 'Search company, role, location, skills...'
                : activeTab === 'email'
                  ? 'Search title, company, location, skills, mailbox...'
                  : 'Search title, company, location, skills...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        {activeTab === 'linkedin' ? (
          <span className="text-[11px] text-sky-600 font-medium">{filtered.length} of {linkedinJobs.length} jobs</span>
        ) : activeTab !== 'highpaid' ? (
          <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
            {(['ALL', 'C2C', 'W2', 'CONTRACT', 'C2H'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setEmpFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  empFilter === f
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex rounded-lg border border-amber-300 bg-white p-0.5">
            {(['ALL', 'MEGA', 'ELITE', 'PREMIUM', 'HIGH'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCompTierFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  compTierFilter === f
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f === 'ALL' ? 'ALL' : TIER_LABELS[f] || f}
              </button>
            ))}
          </div>
        )}
        <span className="text-xs text-gray-400">
          Last refreshed: {lastRefresh.toLocaleTimeString()}
        </span>
      </div>

      {/* Loading */}
      {((activeTab === 'linkedin' && linkedinLoading && !linkedinData) || (activeTab !== 'highpaid' && activeTab !== 'linkedin' && loading && !data) || (activeTab === 'highpaid' && highPaidLoading && !highPaidData)) && (
        <div className="flex items-center justify-center py-20">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Job Cards — LinkedIn Intelligence */}
      {activeTab === 'linkedin' && (linkedinData || linkedinLoading) && (
        <div className="space-y-2">
          {!linkedinLoading && filtered.length === 0 ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-12 text-center">
              <BriefcaseIcon className="mx-auto h-10 w-10 text-sky-400 mb-3" />
              <p className="text-sm font-medium text-sky-800">No LinkedIn jobs match your filters</p>
              <p className="text-xs text-sky-600 mt-1">LinkedIn jobs are sourced via aggregators (JSearch indexes LinkedIn postings). Adjust filters or check back later.</p>
            </div>
          ) : (
            filtered.slice(0, visibleCount).map((job: any) => {
              const scoreBg = job.linkedinScore >= 80 ? 'bg-emerald-500' : job.linkedinScore >= 60 ? 'bg-sky-500' : job.linkedinScore >= 40 ? 'bg-amber-500' : 'bg-gray-400';
              const tierColor = VENDOR_TIER_COLORS[job.vendorQualityTier] || VENDOR_TIER_COLORS.low_confidence;
              return (
                <div
                  key={job.id}
                  className={`rounded-xl border-2 bg-white hover:shadow-md transition-all ${
                    job.linkedinScore >= 80 ? 'border-emerald-300' :
                    job.linkedinScore >= 60 ? 'border-sky-200' :
                    job.linkedinScore >= 40 ? 'border-amber-200' :
                    'border-gray-200'
                  }`}
                >
                  <div
                    className="flex items-start gap-3 p-4 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                  >
                    {/* Left: Score + Vendor Tier */}
                    <div className="shrink-0 mt-0.5 flex flex-col items-center gap-1.5 min-w-[76px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div className={`h-full rounded-full ${scoreBg}`} style={{ width: `${job.linkedinScore}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-700">{job.linkedinScore}</span>
                      </div>
                      <span className={`inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5 text-[9px] font-bold ${tierColor}`}>
                        <ShieldCheckIcon className="h-3 w-3" />
                        {VENDOR_TIER_LABELS[job.vendorQualityTier] || 'Unverified'}
                      </span>
                      {job.submissionLikelihood && job.submissionLikelihood !== 'unlikely' && (
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${LIKELIHOOD_COLORS[job.submissionLikelihood] || ''}`}>
                          {job.submissionLikelihood === 'high' ? 'High Submit' : job.submissionLikelihood === 'medium' ? 'Med Submit' : 'Low Submit'}
                        </span>
                      )}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {job.employmentType && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${EMP_COLORS[job.employmentType] || 'bg-gray-100 text-gray-700'}`}>
                            {job.employmentType}
                          </span>
                        )}
                        <h3 className="font-semibold text-gray-900 text-sm truncate">{job.title}</h3>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1 font-semibold text-gray-800">
                          <BuildingOffice2Icon className="h-3.5 w-3.5 text-gray-600" />
                          {job.company}
                        </span>
                        {job.location && (
                          <span className="flex items-center gap-0.5">
                            <MapPinIcon className="h-3 w-3" />
                            {job.location}
                          </span>
                        )}
                        {job.locationType && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            job.locationType === 'REMOTE' ? 'bg-teal-100 text-teal-700' :
                            job.locationType === 'HYBRID' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {job.locationType}
                          </span>
                        )}
                        {job.rateDisplay && (
                          <span className="flex items-center gap-0.5 text-green-700 font-medium">
                            <CurrencyDollarIcon className="h-3 w-3" />
                            {job.rateDisplay}
                          </span>
                        )}
                      </div>
                      {/* Recruiter contact info */}
                      {(job.recruiterName || job.recruiterEmail) && (
                        <div className="flex items-center gap-3 mt-1 text-[11px]">
                          {job.recruiterName && (
                            <span className="flex items-center gap-1 text-gray-600">
                              <UserIcon className="h-3 w-3" />
                              {job.recruiterName}
                            </span>
                          )}
                          {job.recruiterEmail && (
                            <a href={`mailto:${job.recruiterEmail}`} onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-0.5 text-indigo-600 hover:underline">
                              <EnvelopeIcon className="h-3 w-3" />
                              {job.recruiterEmail}
                            </a>
                          )}
                          {job.recruiterPhone && (
                            <a href={`tel:${job.recruiterPhone}`} onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-0.5 text-indigo-600 hover:underline">
                              <PhoneIcon className="h-3 w-3" />
                              {job.recruiterPhone}
                            </a>
                          )}
                        </div>
                      )}
                      {(job.applyUrl || job.sourceUrl) && (
                        <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                          <a
                            href={job.applyUrl || job.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-0.5 text-sky-600 hover:text-sky-800 hover:underline"
                          >
                            <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                            View on LinkedIn
                          </a>
                        </div>
                      )}
                      {job.skills && job.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {job.skills.slice(0, 6).map((s: string) => (
                            <span key={s} className="rounded bg-sky-50 border border-sky-200 px-1.5 py-0.5 text-[10px] text-sky-700 font-medium">{s}</span>
                          ))}
                          {job.skills.length > 6 && <span className="text-[10px] text-gray-400">+{job.skills.length - 6}</span>}
                        </div>
                      )}
                    </div>

                    {/* Right: time + rate */}
                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                      <span className="text-[10px] text-gray-400">{job.freshnessHours != null ? (job.freshnessHours < 1 ? 'just now' : job.freshnessHours < 24 ? `${job.freshnessHours}h ago` : `${Math.floor(job.freshnessHours / 24)}d ago`) : '—'}</span>
                      {job.annualRate > 0 && (
                        <p className="text-xs font-bold text-green-700">${Math.round(job.annualRate / 1000)}K/yr</p>
                      )}
                      {job.vendorConfidenceScore > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] text-gray-400">Vendor</span>
                          <span className="text-[10px] font-bold text-gray-600">{job.vendorConfidenceScore}%</span>
                        </div>
                      )}
                      {expandedId === job.id ? <ChevronUpIcon className="h-4 w-4 text-gray-400" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {expandedId === job.id && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gradient-to-b from-sky-50/40 to-white text-xs space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div>
                          <p className="font-medium text-gray-700">Company</p>
                          <p className="text-gray-900 font-semibold">{job.company}</p>
                          {job.companyDomain && <p className="text-gray-400">{job.companyDomain}</p>}
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Vendor Intelligence</p>
                          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${tierColor}`}>
                            {VENDOR_TIER_LABELS[job.vendorQualityTier] || 'Unverified'}
                          </span>
                          <p className="text-[10px] text-gray-400 mt-0.5">Confidence: {job.vendorConfidenceScore}%</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Opportunity Score</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="w-16 h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div className={`h-full rounded-full ${scoreBg}`} style={{ width: `${job.linkedinScore}%` }} />
                            </div>
                            <span className="text-sm font-bold text-gray-700">{job.linkedinScore}/100</span>
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Recruiter Contact</p>
                          <p className="text-gray-600">{job.recruiterName || '—'}</p>
                          {job.recruiterEmail && <a href={`mailto:${job.recruiterEmail}`} className="text-indigo-600 hover:underline">{job.recruiterEmail}</a>}
                          {job.recruiterPhone && <a href={`tel:${job.recruiterPhone}`} className="block text-indigo-600 hover:underline">{job.recruiterPhone}</a>}
                          {job.recruiterLinkedIn && <a href={job.recruiterLinkedIn} target="_blank" rel="noopener noreferrer" className="block text-sky-600 hover:underline text-[10px]">LinkedIn Profile</a>}
                          <p className="text-[10px] text-gray-400 mt-0.5">Contact strength: {job.recruiterContactStrength}%</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Submission Likelihood</p>
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${LIKELIHOOD_COLORS[job.submissionLikelihood] || 'text-gray-500 bg-gray-50'}`}>
                            {(job.submissionLikelihood || 'unknown').toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Ranking reasons — explainability */}
                      {job.rankingReasons && job.rankingReasons.length > 0 && (
                        <div>
                          <p className="font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <SparklesIcon className="h-3.5 w-3.5 text-sky-500" />
                            Why this job scores {job.linkedinScore}/100
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {job.rankingReasons.map((r: string, i: number) => (
                              <span key={i} className="rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] text-sky-700 font-medium">{r}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vendor reason codes */}
                      {job.vendorReasonCodes && job.vendorReasonCodes.length > 0 && (
                        <div>
                          <p className="font-medium text-gray-700 mb-1">Vendor Signals</p>
                          <div className="flex flex-wrap gap-1.5">
                            {job.vendorReasonCodes.map((r: string, i: number) => (
                              <span key={i} className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] text-emerald-700 font-medium">{r.replace(/_/g, ' ')}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Source Compliance & Lineage */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
                        <div>
                          <p className="font-medium text-gray-700">Source Compliance</p>
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold mt-0.5 ${
                            job.sourceComplianceClass === 'FIRST_PARTY_CAREER_SITE' ? 'bg-green-100 text-green-800' :
                            job.sourceComplianceClass === 'LICENSED_PROVIDER' ? 'bg-blue-100 text-blue-800' :
                            job.sourceComplianceClass === 'EMAIL_INTEL_DERIVED' ? 'bg-violet-100 text-violet-800' :
                            job.sourceComplianceClass === 'MANUAL_IMPORT' ? 'bg-amber-100 text-amber-800' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {(job.sourceComplianceClass || 'LICENSED_PROVIDER').replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Source Platform</p>
                          <p className="text-gray-600 text-[11px]">{job.sourcePlatform || job.source}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Source Confidence</p>
                          <p className="text-gray-600">{job.sourceConfidenceLevel || '—'}%</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Eligibility</p>
                          <p className="text-[10px] text-gray-500">{job.linkedInEligibilityReason || '—'}</p>
                        </div>
                      </div>
                      {job.complianceNotes && (
                        <p className="text-[10px] text-gray-400 italic">{job.complianceNotes}</p>
                      )}

                      {/* Action links */}
                      <div className="flex gap-3 pt-2 border-t border-gray-100">
                        {(job.applyUrl || job.sourceUrl) && (
                          <a href={job.applyUrl || job.sourceUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-lg bg-sky-600 px-4 py-2 text-white font-medium hover:bg-sky-700 transition-colors">
                            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" /> Open Job
                          </a>
                        )}
                        {job.recruiterEmail && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(job.recruiterEmail); }}
                            className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                          >
                            <ClipboardDocumentIcon className="h-3.5 w-3.5" /> Copy Contact
                          </button>
                        )}
                        {job.sourceUrl && job.sourceUrl !== job.applyUrl && (
                          <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                            <GlobeAltIcon className="h-3.5 w-3.5" /> View Source
                          </a>
                        )}
                      </div>

                      {job.skills && job.skills.length > 0 && (
                        <div>
                          <p className="font-medium text-gray-700 mb-1">Skills & Technologies</p>
                          <div className="flex flex-wrap gap-1">
                            {job.skills.map((s: string) => (
                              <span key={s} className="rounded bg-sky-50 border border-sky-200 text-sky-700 px-2 py-0.5 text-[10px] font-medium">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {filtered.length > visibleCount && (
            <button
              onClick={() => setVisibleCount(prev => prev + 50)}
              className="mt-2 w-full rounded-lg border border-sky-200 bg-sky-50 py-2.5 text-sm font-medium text-sky-700 hover:bg-sky-100 transition-colors"
            >
              Show more ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}

      {/* Job Cards — Standard (Email Intel / Job Boards) */}
      {activeTab !== 'highpaid' && activeTab !== 'linkedin' && data && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center text-sm text-gray-500">
              {activeTab === 'email'
                ? 'No email intel jobs match your filters'
                : 'No job board openings match your filters'}
            </div>
          ) : (
            filtered.slice(0, visibleCount).map((job: any) => (
              <div
                key={job.id}
                className="rounded-xl border border-gray-200 bg-white hover:shadow-sm transition-shadow"
              >
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                >
                  <div className="shrink-0 mt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold ${
                        SOURCE_COLORS[job.source] || 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {job.source === 'Email Intel' ? (
                        <EnvelopeIcon className="h-3 w-3" />
                      ) : (
                        <GlobeAltIcon className="h-3 w-3" />
                      )}
                      {job.source}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          EMP_COLORS[job.employmentType] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {job.employmentType}
                      </span>
                      <h3 className="font-medium text-gray-900 text-sm truncate">{job.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="font-medium text-gray-700">{job.company}</span>
                      {job.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPinIcon className="h-3 w-3" />
                          {job.location}
                        </span>
                      )}
                      {job.rateText && (
                        <span className="flex items-center gap-0.5 text-green-700 font-medium">
                          <CurrencyDollarIcon className="h-3 w-3" />
                          {job.rateText}
                        </span>
                      )}
                    </div>
                    {job.source === 'Email Intel' && job.receivedByEmail && (
                      <div className="flex items-center gap-3 mt-1 text-[11px]">
                        <span className="flex items-center gap-1 text-violet-600">
                          <InboxArrowDownIcon className="h-3 w-3" />
                          {job.receivedByEmail}
                        </span>
                        {job.fromEmail && (
                          <span className="flex items-center gap-1 text-gray-500">
                            <UserIcon className="h-3 w-3" />
                            from {job.fromName ? `${job.fromName} <${job.fromEmail}>` : job.fromEmail}
                          </span>
                        )}
                      </div>
                    )}
                    {job.source !== 'Email Intel' && (job.applyUrl || job.sourceUrl) && (
                      <div className="flex items-center gap-2 mt-1 text-[11px]">
                        <a
                          href={job.applyUrl || job.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                          View Original Posting
                        </a>
                      </div>
                    )}
                    {job.skills && job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {job.skills.slice(0, 6).map((s: string) => (
                          <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{s}</span>
                        ))}
                        {job.skills.length > 6 && <span className="text-[10px] text-gray-400">+{job.skills.length - 6}</span>}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    <span className="text-[10px] text-gray-400">{timeAgo(job.receivedAt)}</span>
                    {job.actionabilityScore != null && job.actionabilityScore > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-10 rounded-full bg-gray-200">
                          <div
                            className={`h-1.5 rounded-full ${
                              job.actionabilityScore >= 70 ? 'bg-emerald-500' : job.actionabilityScore >= 40 ? 'bg-amber-500' : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(job.actionabilityScore, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500">{job.actionabilityScore}</span>
                      </div>
                    )}
                    {expandedId === job.id ? <ChevronUpIcon className="h-4 w-4 text-gray-400" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>
                {expandedId === job.id && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 text-xs space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {job.source === 'Email Intel' ? (
                        <>
                          <div><p className="font-medium text-gray-700">Received By</p><p className="text-violet-600 font-medium">{job.receivedByEmail || '—'}</p></div>
                          <div><p className="font-medium text-gray-700">From</p><p className="text-gray-500">{job.fromName || '—'}</p>{job.fromEmail ? <a href={`mailto:${job.fromEmail}`} className="text-indigo-600 hover:underline">{job.fromEmail}</a> : <p className="text-gray-400">—</p>}</div>
                          <div><p className="font-medium text-gray-700">Vendor</p>{job.vendorDomain ? <a href={`https://${job.vendorDomain}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{job.vendorDomain}</a> : <p className="text-gray-500">—</p>}</div>
                          <div><p className="font-medium text-gray-700">Vendor Trust</p><p className="text-gray-500">{job.vendorTrust || 0}/100</p></div>
                          <div><p className="font-medium text-gray-700">Contact</p><p className="text-gray-500">{job.contactName || '—'}</p>{job.contactEmail ? <a href={job.contactEmail.startsWith('http') ? job.contactEmail : `mailto:${job.contactEmail}`} target={job.contactEmail.startsWith('http') ? '_blank' : undefined} rel={job.contactEmail.startsWith('http') ? 'noopener noreferrer' : undefined} className="text-indigo-600 hover:underline">{job.contactEmail.startsWith('http') ? 'View Posting' : job.contactEmail}</a> : <p className="text-gray-400">—</p>}</div>
                          <div><p className="font-medium text-gray-700">Engagement</p><p className="text-gray-500">{job.engagementModel || '—'}</p></div>
                        </>
                      ) : (
                        <>
                          <div><p className="font-medium text-gray-700">Source</p><p className="text-blue-600 font-medium">{job.source}</p></div>
                          <div><p className="font-medium text-gray-700">Company</p>{job.vendorDomain ? <a href={`https://${job.vendorDomain}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{job.vendorDomain}</a> : <p className="text-gray-500">{job.company || '—'}</p>}</div>
                          <div><p className="font-medium text-gray-700">Recruiter</p><p className="text-gray-500">{job.contactName || '—'}</p>{job.contactEmail ? <a href={`mailto:${job.contactEmail}`} className="text-indigo-600 hover:underline">{job.contactEmail}</a> : <p className="text-gray-400">—</p>}</div>
                          <div><p className="font-medium text-gray-700">Realness Score</p><p className="text-gray-500">{job.vendorTrust || 0}/100</p></div>
                          {(job.applyUrl || job.sourceUrl) && (
                            <div className="col-span-2">
                              <p className="font-medium text-gray-700 mb-1">Links</p>
                              <div className="flex gap-3">
                                {job.applyUrl && <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline"><ArrowTopRightOnSquareIcon className="h-3 w-3" />Apply</a>}
                                {job.sourceUrl && <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline"><GlobeAltIcon className="h-3 w-3" />Source</a>}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {job.skills && job.skills.length > 0 && (
                      <div>
                        <p className="font-medium text-gray-700 mb-1">All Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {job.skills.map((s: string) => (
                            <span key={s} className="rounded bg-indigo-50 text-indigo-700 px-1.5 py-0.5 text-[10px] font-medium">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {filtered.length > visibleCount && (
            <button
              onClick={() => setVisibleCount(prev => prev + 50)}
              className="mt-2 w-full rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              Show more ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}

      {/* Job Cards — High-Paid FAANG/Tech */}
      {activeTab === 'highpaid' && (highPaidData || highPaidLoading) && (
        <div className="space-y-2">
          {!highPaidLoading && filtered.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-12 text-center">
              <BanknotesIcon className="mx-auto h-10 w-10 text-amber-400 mb-3" />
              <p className="text-sm font-medium text-amber-800">No high-paid roles match your filters</p>
              <p className="text-xs text-amber-600 mt-1">High-paid roles are crawled from FAANG & top tech company career pages hourly</p>
            </div>
          ) : (
            filtered.slice(0, visibleCount).map((job: any) => (
              <div
                key={job.id}
                className={`rounded-xl border-2 bg-white hover:shadow-md transition-all ${
                  job.tier === 'MEGA' ? 'border-yellow-300 shadow-yellow-100/50' :
                  job.tier === 'ELITE' ? 'border-purple-300 shadow-purple-100/50' :
                  job.tier === 'PREMIUM' ? 'border-blue-200' :
                  'border-emerald-200'
                }`}
              >
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                >
                  {/* Left: Comp + Score */}
                  <div className="shrink-0 mt-0.5 flex flex-col items-center gap-1.5 min-w-[80px]">
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold shadow-sm ${TIER_COLORS[job.tier] || 'bg-gray-100 text-gray-700'}`}>
                      <BanknotesIcon className="h-3.5 w-3.5" />
                      {job.compDisplay || 'N/A'}
                    </span>
                    {job.opportunityScore > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-10 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div className={`h-full rounded-full ${
                            job.opportunityScore >= 80 ? 'bg-green-500' :
                            job.opportunityScore >= 60 ? 'bg-blue-500' : 'bg-gray-400'
                          }`} style={{ width: `${job.opportunityScore}%` }} />
                        </div>
                        <span className="text-[9px] font-bold text-gray-500">{job.opportunityScore}</span>
                      </div>
                    )}
                    {job.isFaang && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600">
                        <StarIcon className="h-3 w-3" /> FAANG+
                      </span>
                    )}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 text-sm">{job.title}</h3>
                      {job.compType === 'BASE' && (
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-green-100 text-green-700 border border-green-200">VERIFIED BASE</span>
                      )}
                      {job.compType === 'TOTAL' && (
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200">EST. BASE</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-gray-800">
                        <BuildingOffice2Icon className="h-3.5 w-3.5 text-gray-600" />
                        {job.company}
                      </span>
                      {job.companyTier && (
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                          job.companyTier === 'FAANG' ? 'bg-amber-100 text-amber-700' :
                          job.companyTier === 'AI_INFRA' ? 'bg-purple-100 text-purple-700' :
                          job.companyTier === 'MEGA_TECH' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {job.companyTier === 'FAANG' ? 'FAANG' : job.companyTier === 'AI_INFRA' ? 'AI/Infra' : job.companyTier === 'MEGA_TECH' ? 'Enterprise' : 'High Growth'}
                        </span>
                      )}
                      {job.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPinIcon className="h-3 w-3" />
                          {job.location}
                        </span>
                      )}
                      {job.locationType && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          job.locationType === 'REMOTE' ? 'bg-teal-100 text-teal-700' :
                          job.locationType === 'HYBRID' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {job.locationType}
                        </span>
                      )}
                    </div>
                    {job.applyUrl && (
                      <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                        <a
                          href={job.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 rounded-md bg-indigo-600 px-3 py-1 text-white font-medium hover:bg-indigo-700 transition-colors"
                        >
                          <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                          Apply Now
                        </a>
                        <span className="text-gray-400">
                          via {job.faangSource === 'GREENHOUSE' || job.faangSource === 'LEVER' ? 'Career Page' : job.source || 'Direct'}
                        </span>
                      </div>
                    )}
                    {job.skills && job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {job.skills.slice(0, 8).map((s: string) => (
                          <span key={s} className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] text-amber-700 font-medium">{s}</span>
                        ))}
                        {job.skills.length > 8 && <span className="text-[10px] text-gray-400">+{job.skills.length - 8}</span>}
                      </div>
                    )}
                  </div>

                  {/* Right side: comp breakdown */}
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    <span className="text-[10px] text-gray-400">{timeAgo(job.postedAt)}</span>
                    {job.baseMin > 0 && job.baseMax > 0 && (
                      <div className="text-right">
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider">Base</p>
                        <p className="text-xs font-bold text-green-700">${Math.round(job.baseMin / 1000)}K – ${Math.round(job.baseMax / 1000)}K</p>
                      </div>
                    )}
                    {job.totalCompDisplay && (
                      <div className="text-right mt-0.5">
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider">Est. Total</p>
                        <p className="text-[11px] font-semibold text-indigo-600">{job.totalCompDisplay}</p>
                      </div>
                    )}
                    {expandedId === job.id ? <ChevronUpIcon className="h-4 w-4 text-gray-400" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded Detail */}
                {expandedId === job.id && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gradient-to-b from-gray-50/80 to-white text-xs space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <p className="font-medium text-gray-700">Company</p>
                        <p className="text-gray-900 font-semibold">{job.company}</p>
                        {job.companyDomain && <p className="text-gray-400">{job.companyDomain}</p>}
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Base Salary</p>
                        <p className="text-green-700 font-bold text-sm">{job.compDisplay}</p>
                        {job.compType === 'BASE' && <p className="text-[10px] text-green-600">From job posting (CA/NY/CO disclosure)</p>}
                        {job.compType === 'TOTAL' && <p className="text-[10px] text-orange-600">Estimated from total comp disclosure</p>}
                      </div>
                      {job.totalMin > 0 && job.totalMax > 0 && (
                        <div>
                          <p className="font-medium text-gray-700">Est. Total Comp</p>
                          <p className="text-indigo-700 font-bold text-sm">${Math.round(job.totalMin / 1000)}K – ${Math.round(job.totalMax / 1000)}K</p>
                          <p className="text-[10px] text-gray-400">{job.hasEquity ? 'Includes RSU/stock' : 'Base + est. bonus'}</p>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-700">Location</p>
                        <p className="text-gray-600">{job.location || '—'}</p>
                        {job.locationType && <span className="text-gray-400">{job.locationType}</span>}
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Opportunity Score</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="w-16 h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div className={`h-full rounded-full ${
                              job.opportunityScore >= 80 ? 'bg-green-500' :
                              job.opportunityScore >= 60 ? 'bg-blue-500' : 'bg-gray-400'
                            }`} style={{ width: `${job.opportunityScore}%` }} />
                          </div>
                          <span className="text-sm font-bold text-gray-700">{job.opportunityScore}/100</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2 border-t border-gray-100">
                      {job.applyUrl && (
                        <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 transition-colors">
                          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" /> Apply Now
                        </a>
                      )}
                      {job.sourceUrl && job.sourceUrl !== job.applyUrl && (
                        <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                          <GlobeAltIcon className="h-3.5 w-3.5" /> View Source
                        </a>
                      )}
                    </div>
                    {job.skills && job.skills.length > 0 && (
                      <div>
                        <p className="font-medium text-gray-700 mb-1">Skills & Technologies</p>
                        <div className="flex flex-wrap gap-1">
                          {job.skills.map((s: string) => (
                            <span key={s} className="rounded bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 text-[10px] font-medium">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {filtered.length > visibleCount && (
            <button
              onClick={() => setVisibleCount(prev => prev + 50)}
              className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            >
              Show more ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
