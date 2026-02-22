import { Menu } from 'lucide-react';
import { useMobileSidebar } from './Layout';

interface HeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { toggle: toggleMobileSidebar } = useMobileSidebar();

  return (
    <header className="h-16 bg-bg-surface border-b border-border px-4 md:px-6 flex items-center justify-between transition-colors">
      {/* Left side: hamburger (mobile) + title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger menu - mobile only */}
        <button
          onClick={toggleMobileSidebar}
          className="p-2 -ml-2 text-text-muted hover:text-text-secondary hover:bg-bg-hover rounded-lg transition-colors md:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        {title && (
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold text-text">{title}</h1>
            {subtitle && <span className="hidden md:inline text-sm text-text-muted">{subtitle}</span>}
          </div>
        )}
      </div>

      {/* Right side: page-specific actions */}
      {actions && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
