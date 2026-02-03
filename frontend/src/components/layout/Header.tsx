import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home, Menu } from 'lucide-react';
import { useMobileSidebar } from './Layout';

interface HeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbLabel?: string;
}

export function Header({ title, subtitle, actions, breadcrumbLabel }: HeaderProps) {
  const location = useLocation();
  const { toggle: toggleMobileSidebar } = useMobileSidebar();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = '/' + pathSegments.slice(0, index + 1).join('/');
    const isLast = index === pathSegments.length - 1;
    // Use custom breadcrumbLabel for the last segment if provided
    const label = isLast && breadcrumbLabel ? breadcrumbLabel : segment.charAt(0).toUpperCase() + segment.slice(1);

    return { path, label, isLast };
  });

  // Show title for top-level pages (when title is provided)
  // Show breadcrumbs only for nested pages (e.g., /cases/123)
  const showTitle = !!title;
  const showBreadcrumbs = !showTitle && breadcrumbs.length > 1;

  return (
    <header className="h-16 bg-bg-surface border-b border-border px-4 md:px-6 flex items-center justify-between transition-colors">
      {/* Left side: hamburger (mobile) + title or breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger menu - mobile only */}
        <button
          onClick={toggleMobileSidebar}
          className="p-2 -ml-2 text-text-muted hover:text-text-secondary hover:bg-bg-hover rounded-lg transition-colors md:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        {showTitle ? (
          /* Title + subtitle for main pages */
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold text-text">{title}</h1>
            {subtitle && <span className="hidden md:inline text-sm text-text-muted">{subtitle}</span>}
          </div>
        ) : showBreadcrumbs ? (
          /* Breadcrumbs for nested pages (e.g., /cases/123) */
          <nav className="flex items-center gap-1 text-sm text-text-muted">
            <Link to="/" className="hover:text-text-secondary transition-colors">
              <Home className="w-4 h-4" />
            </Link>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.path} className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4" />
                {crumb.isLast ? (
                  <span className="text-text font-medium">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="hover:text-text-secondary transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        ) : null}
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
