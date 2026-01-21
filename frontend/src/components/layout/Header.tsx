import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface HeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = '/' + pathSegments.slice(0, index + 1).join('/');
    const label = segment.charAt(0).toUpperCase() + segment.slice(1);
    const isLast = index === pathSegments.length - 1;

    return { path, label, isLast };
  });

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-slate-400 mb-2">
          <Link to="/" className="hover:text-slate-200 transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.path} className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4" />
              {crumb.isLast ? (
                <span className="text-slate-100 font-medium">{crumb.label}</span>
              ) : (
                <Link
                  to={crumb.path}
                  className="hover:text-slate-200 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title and actions */}
      <div className="flex items-center justify-between">
        <div>
          {title && <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>}
          {subtitle && <p className="text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
