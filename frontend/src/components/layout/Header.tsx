import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbLabel?: string;
}

export function Header({ title, subtitle, actions, breadcrumbLabel }: HeaderProps) {
  const location = useLocation();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
    <header className="h-16 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 flex items-center justify-between transition-colors">
      {/* Left side: title or breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {showTitle ? (
          /* Title + subtitle for main pages */
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
            {subtitle && <span className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</span>}
          </div>
        ) : showBreadcrumbs ? (
          /* Breadcrumbs for nested pages (e.g., /cases/123) */
          <nav className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <Link to="/" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
              <Home className="w-4 h-4" />
            </Link>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.path} className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4" />
                {crumb.isLast ? (
                  <span className="text-slate-900 dark:text-slate-100 font-medium">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        ) : null}
      </div>

      {/* Right side: actions + theme toggle + logout */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {actions}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button
          onClick={logout}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
