import type { CaseStatus, TaskStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'status' | 'urgency';
  status?: CaseStatus | TaskStatus | string;
  urgency?: number;
  size?: 'sm' | 'md';
  className?: string;
}

const statusColors: Record<string, string> = {
  // Case statuses
  'Signing Up': 'bg-blue-100 text-blue-700',
  'Prospective': 'bg-purple-100 text-purple-700',
  'Pre-Filing': 'bg-indigo-100 text-indigo-700',
  'Pleadings': 'bg-cyan-100 text-cyan-700',
  'Discovery': 'bg-sky-100 text-sky-700',
  'Expert Discovery': 'bg-teal-100 text-teal-700',
  'Pre-trial': 'bg-amber-100 text-amber-700',
  'Trial': 'bg-orange-100 text-orange-700',
  'Post-Trial': 'bg-rose-100 text-rose-700',
  'Appeal': 'bg-red-100 text-red-700',
  'Settl. Pend.': 'bg-lime-100 text-lime-700',
  'Stayed': 'bg-slate-100 text-slate-700',
  'Closed': 'bg-gray-100 text-gray-500',
  // Task statuses
  'Pending': 'bg-yellow-100 text-yellow-700',
  'Active': 'bg-blue-100 text-blue-700',
  'Done': 'bg-green-100 text-green-700',
  'Partially Complete': 'bg-cyan-100 text-cyan-700',
  'Blocked': 'bg-red-100 text-red-700',
  'Awaiting Atty Review': 'bg-purple-100 text-purple-700',
  // Event statuses
  'Met': 'bg-green-100 text-green-700',
  'Missed': 'bg-red-100 text-red-700',
};

const urgencyColors: Record<number, string> = {
  1: 'bg-green-100 text-green-700',     // Low
  2: 'bg-yellow-100 text-yellow-700',   // Medium
  3: 'bg-orange-100 text-orange-700',   // High
  4: 'bg-red-100 text-red-700',         // Urgent
};

export function Badge({
  children,
  variant = 'default',
  status,
  urgency,
  size = 'md',
  className = '',
}: BadgeProps) {
  let colorClasses = 'bg-slate-100 text-slate-700';

  if (variant === 'status' && status) {
    colorClasses = statusColors[status] || colorClasses;
  } else if (variant === 'urgency' && urgency !== undefined) {
    colorClasses = urgencyColors[urgency] || colorClasses;
  }

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${colorClasses}
        ${sizeClasses}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="status" status={status}>
      {status}
    </Badge>
  );
}

export function UrgencyBadge({ urgency }: { urgency: number }) {
  return (
    <Badge variant="urgency" urgency={urgency}>
      {urgency}
    </Badge>
  );
}
