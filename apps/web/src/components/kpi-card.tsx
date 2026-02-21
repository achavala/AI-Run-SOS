import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/20/solid';

interface KpiCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  subtitle?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export function KpiCard({
  title,
  value,
  change,
  changeType = 'neutral',
  subtitle,
  icon: Icon,
}: KpiCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-semibold tracking-tight text-gray-900">
            {value}
          </p>
        </div>
        {Icon && (
          <div className="rounded-lg bg-indigo-50 p-2.5">
            <Icon className="h-5 w-5 text-indigo-600" />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2">
        {change && (
          <span
            className={`inline-flex items-center gap-0.5 text-sm font-medium ${
              changeType === 'positive'
                ? 'text-emerald-600'
                : changeType === 'negative'
                  ? 'text-red-600'
                  : 'text-gray-500'
            }`}
          >
            {changeType === 'positive' && (
              <ArrowUpIcon className="h-3.5 w-3.5" />
            )}
            {changeType === 'negative' && (
              <ArrowDownIcon className="h-3.5 w-3.5" />
            )}
            {change}
          </span>
        )}
        {subtitle && (
          <span className="text-sm text-gray-400">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
