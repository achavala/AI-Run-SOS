const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',

  SUBMITTED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  SHORTLISTED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  SENT: 'bg-blue-50 text-blue-700 ring-blue-600/20',

  DRAFT: 'bg-gray-50 text-gray-600 ring-gray-500/20',
  ON_HOLD: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PENDING_CONSENT: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  AWAITING_CONSENT: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PARTIAL: 'bg-amber-50 text-amber-700 ring-amber-600/20',

  REJECTED: 'bg-red-50 text-red-700 ring-red-600/20',
  CANCELLED: 'bg-red-50 text-red-700 ring-red-600/20',
  WITHDRAWN: 'bg-red-50 text-red-700 ring-red-600/20',
  OVERDUE: 'bg-red-50 text-red-700 ring-red-600/20',
  TERMINATED: 'bg-red-50 text-red-700 ring-red-600/20',
  DISPUTED: 'bg-red-50 text-red-700 ring-red-600/20',

  FILLED: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  EXTENDED: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  INVOICED: 'bg-violet-50 text-violet-700 ring-violet-600/20',

  REMOTE: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  HYBRID: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  ONSITE: 'bg-orange-50 text-orange-700 ring-orange-600/20',
};

const DEFAULT_STYLE = 'bg-gray-50 text-gray-600 ring-gray-500/20';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? DEFAULT_STYLE;
  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset ${style} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
    >
      {label}
    </span>
  );
}
