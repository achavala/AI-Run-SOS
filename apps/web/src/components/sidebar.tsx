'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  BriefcaseIcon,
  UsersIcon,
  DocumentTextIcon,
  ClockIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
  DocumentCheckIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  FolderIcon,
  CreditCardIcon,
  GlobeAltIcon,
  EnvelopeIcon,
  CircleStackIcon,
  InboxStackIcon,
  SparklesIcon,
  PresentationChartBarIcon,
  QueueListIcon,
  FireIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore, type UserRole } from '@/lib/auth';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  MANAGEMENT: [
    { name: 'Command Center', href: '/dashboard/command-center', icon: HomeIcon },
    { name: 'Closure Engine', href: '/dashboard/closure-engine', icon: FireIcon },
    { name: 'Work Queue', href: '/dashboard/work-queue', icon: QueueListIcon },
    { name: 'AI Agents', href: '/dashboard/ai-agents', icon: SparklesIcon },
    { name: 'Recruiter Analytics', href: '/dashboard/recruiter-analytics', icon: PresentationChartBarIcon },
    { name: 'Live Feed', href: '/dashboard/live-feed', icon: SignalIcon },
    { name: 'Jobs', href: '/dashboard/jobs', icon: BriefcaseIcon },
    { name: 'Vendor Reqs', href: '/dashboard/vendor-reqs', icon: EnvelopeIcon },
    { name: 'Market Jobs', href: '/dashboard/market-jobs', icon: GlobeAltIcon },
    { name: 'Email Intel', href: '/dashboard/pst-intel', icon: CircleStackIcon },
    { name: 'Mail Intel', href: '/dashboard/mail-intel', icon: InboxStackIcon },
    { name: 'Consultants', href: '/dashboard/consultants', icon: UsersIcon },
    { name: 'Submissions', href: '/dashboard/submissions', icon: DocumentTextIcon },
    { name: 'Timesheets', href: '/dashboard/timesheets', icon: ClockIcon },
    { name: 'Vendors', href: '/dashboard/sales', icon: BuildingOfficeIcon },
    { name: 'Accounts', href: '/dashboard/accounts', icon: CurrencyDollarIcon },
    { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon },
  ],
  SUPERADMIN: [
    { name: 'Command Center', href: '/dashboard/command-center', icon: HomeIcon },
    { name: 'Closure Engine', href: '/dashboard/closure-engine', icon: FireIcon },
    { name: 'Work Queue', href: '/dashboard/work-queue', icon: QueueListIcon },
    { name: 'AI Agents', href: '/dashboard/ai-agents', icon: SparklesIcon },
    { name: 'Recruiter Analytics', href: '/dashboard/recruiter-analytics', icon: PresentationChartBarIcon },
    { name: 'Live Feed', href: '/dashboard/live-feed', icon: SignalIcon },
    { name: 'Jobs', href: '/dashboard/jobs', icon: BriefcaseIcon },
    { name: 'Vendor Reqs', href: '/dashboard/vendor-reqs', icon: EnvelopeIcon },
    { name: 'Market Jobs', href: '/dashboard/market-jobs', icon: GlobeAltIcon },
    { name: 'Email Intel', href: '/dashboard/pst-intel', icon: CircleStackIcon },
    { name: 'Mail Intel', href: '/dashboard/mail-intel', icon: InboxStackIcon },
    { name: 'Consultants', href: '/dashboard/consultants', icon: UsersIcon },
    { name: 'Submissions', href: '/dashboard/submissions', icon: DocumentTextIcon },
    { name: 'Timesheets', href: '/dashboard/timesheets', icon: ClockIcon },
    { name: 'Vendors', href: '/dashboard/sales', icon: BuildingOfficeIcon },
    { name: 'Accounts', href: '/dashboard/accounts', icon: CurrencyDollarIcon },
    { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon },
  ],
  RECRUITMENT: [
    { name: 'Dashboard', href: '/dashboard/recruitment', icon: HomeIcon },
    { name: 'Closure Engine', href: '/dashboard/closure-engine', icon: FireIcon },
    { name: 'Work Queue', href: '/dashboard/work-queue', icon: QueueListIcon },
    { name: 'Live Feed', href: '/dashboard/live-feed', icon: SignalIcon },
    { name: 'Jobs', href: '/dashboard/jobs', icon: BriefcaseIcon },
    { name: 'Vendor Reqs', href: '/dashboard/vendor-reqs', icon: EnvelopeIcon },
    { name: 'Market Jobs', href: '/dashboard/market-jobs', icon: GlobeAltIcon },
    { name: 'Email Intel', href: '/dashboard/pst-intel', icon: CircleStackIcon },
    { name: 'Mail Intel', href: '/dashboard/mail-intel', icon: InboxStackIcon },
    { name: 'Consultants', href: '/dashboard/consultants', icon: UsersIcon },
    { name: 'Submissions', href: '/dashboard/submissions', icon: DocumentTextIcon },
  ],
  SALES: [
    { name: 'Dashboard', href: '/dashboard/sales', icon: HomeIcon },
    { name: 'Live Feed', href: '/dashboard/live-feed', icon: SignalIcon },
    { name: 'Jobs', href: '/dashboard/jobs', icon: BriefcaseIcon },
    { name: 'Vendor Reqs', href: '/dashboard/vendor-reqs', icon: EnvelopeIcon },
    { name: 'Market Jobs', href: '/dashboard/market-jobs', icon: GlobeAltIcon },
    { name: 'Email Intel', href: '/dashboard/pst-intel', icon: CircleStackIcon },
    { name: 'Mail Intel', href: '/dashboard/mail-intel', icon: InboxStackIcon },
    { name: 'Vendors', href: '/dashboard/sales', icon: BuildingOfficeIcon },
    { name: 'Submissions', href: '/dashboard/submissions', icon: DocumentTextIcon },
  ],
  ACCOUNTS: [
    { name: 'Dashboard', href: '/dashboard/accounts', icon: HomeIcon },
    { name: 'Timesheets', href: '/dashboard/timesheets', icon: ClockIcon },
    { name: 'Invoices', href: '/dashboard/accounts', icon: DocumentCheckIcon },
    { name: 'Payments', href: '/dashboard/accounts', icon: CreditCardIcon },
    { name: 'Vendors', href: '/dashboard/sales', icon: BuildingOfficeIcon },
  ],
  CONSULTANT: [
    { name: 'My Profile', href: '/dashboard/consultants', icon: UserCircleIcon },
    { name: 'My Submissions', href: '/dashboard/submissions', icon: DocumentTextIcon },
    { name: 'My Timesheets', href: '/dashboard/timesheets', icon: ClockIcon },
    { name: 'My Pay', href: '/dashboard/accounts', icon: CurrencyDollarIcon },
  ],
  HR: [
    { name: 'Consultants', href: '/dashboard/consultants', icon: UsersIcon },
    { name: 'Onboarding', href: '/dashboard/consultants', icon: ChartBarIcon },
    { name: 'Compliance', href: '/dashboard/consultants', icon: ShieldCheckIcon },
  ],
  IMMIGRATION: [
    { name: 'Cases', href: '/dashboard/consultants', icon: FolderIcon },
    { name: 'Consultants', href: '/dashboard/consultants', icon: UsersIcon },
    { name: 'Documents', href: '/dashboard/consultants', icon: DocumentTextIcon },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const role = (user?.role ?? 'MANAGEMENT') as UserRole;
  const navItems = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.MANAGEMENT;

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <span className="text-sm font-bold text-white">S</span>
        </div>
        <span className="text-lg font-semibold text-white">StaffingOS</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-active text-white'
                  : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
              }`}
            >
              <item.icon
                className={`h-5 w-5 shrink-0 ${
                  isActive ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-700/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600/20 text-sm font-medium text-indigo-400">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-white">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-xs text-gray-400">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-sidebar-hover hover:text-white"
            title="Sign out"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
