import type { CaseStatus, TaskStatus } from '../../types';
import { getStatusColorClasses, getUrgencyColorClasses, BADGE_PALETTE, colorToClasses } from '../../config/colors';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'status' | 'urgency';
  status?: CaseStatus | TaskStatus | string;
  urgency?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const defaultColor = colorToClasses(BADGE_PALETTE.slate);

export function Badge({
  children,
  variant = 'default',
  status,
  urgency,
  size = 'md',
  className = '',
}: BadgeProps) {
  let colorClasses = defaultColor;

  if (variant === 'status' && status) {
    colorClasses = getStatusColorClasses(status);
  } else if (variant === 'urgency' && urgency !== undefined) {
    colorClasses = getUrgencyColorClasses(urgency);
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

export function UrgencyBadge({ urgency }: { urgency: string }) {
  return (
    <Badge variant="urgency" urgency={urgency}>
      {urgency}
    </Badge>
  );
}
