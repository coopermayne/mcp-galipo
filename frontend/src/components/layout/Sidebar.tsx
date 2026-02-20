import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Inbox,
  CheckSquare,
  Clock,
  Scale,
  Download,
  Webhook,
  Users,
  UserCog,
  FileText,
  FileSearch,
  List,
  FileSignature,
  Receipt,
  ChevronRight,
  X,
  Sun,
  Moon,
  FlaskConical,
  Shield,
  Handshake,
  Gavel,
  UserCircle,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getAuthToken, useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ProfileDropdown } from '../auth';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  featureKey?: string;
  children?: { name: string; href: string; icon: LucideIcon }[];
}

const baseNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, featureKey: 'dashboard' },
  { name: 'Cases', href: '/cases', icon: Briefcase, featureKey: 'cases' },
  { name: 'Intake', href: '/intakes', icon: Inbox, featureKey: 'intakes' },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, featureKey: 'tasks' },
  { name: 'Calendar', href: '/calendar', icon: Clock, featureKey: 'calendar' },
  {
    name: 'Templates',
    href: '/templates',
    icon: FileText,
    featureKey: 'templates',
    children: [
      { name: 'Pleadings', href: '/templates/pleadings', icon: FileText },
      { name: 'RFP', href: '/templates/rfp', icon: FileSearch },
      { name: 'Case List', href: '/templates/case-list', icon: List },
      { name: 'Retainer', href: '/templates/retainer', icon: FileSignature },
      { name: 'Disbursement', href: '/templates/disbursement', icon: Receipt },
    ],
  },
  { name: 'CourtListener', href: '/courtlistener', icon: Webhook, featureKey: 'courtlistener' },
  {
    name: 'People',
    href: '/persons',
    icon: Users,
    featureKey: 'people',
    children: [
      { name: 'Clients', href: '/persons/clients', icon: Users },
      { name: 'Counsel', href: '/persons/counsel', icon: Briefcase },
      { name: 'Experts', href: '/persons/experts', icon: FlaskConical },
      { name: 'Defendants', href: '/persons/defendants', icon: Shield },
      { name: 'Mediators', href: '/persons/mediators', icon: Handshake },
      { name: 'Judges', href: '/persons/judges', icon: Gavel },
      { name: 'Other', href: '/persons/other', icon: UserCircle },
    ],
  },
];

const adminNavigation: NavItem[] = [
  { name: 'Users', href: '/users', icon: UserCog, adminOnly: true },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // Generic expand state for any nav item with children
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of baseNavigation) {
      if (item.children && location.pathname.startsWith(item.href)) {
        initial[item.href] = true;
      }
    }
    return initial;
  });

  // Auto-expand when navigating to a child route
  useEffect(() => {
    for (const item of baseNavigation) {
      if (item.children && location.pathname.startsWith(item.href)) {
        setOpenSections(prev => prev[item.href] ? prev : { ...prev, [item.href]: true });
      }
    }
  }, [location.pathname]);

  // Build navigation based on user role and visible features
  const navigation = useMemo(() => {
    let items = baseNavigation;
    // If non-admin user has visibleFeatures set, filter out disabled items
    if (user && !user.isAdmin && user.visibleFeatures) {
      items = items.filter(item => !item.featureKey || user.visibleFeatures![item.featureKey] !== false);
    }
    if (user?.isAdmin) {
      return [...items, ...adminNavigation];
    }
    return items;
  }, [user]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const token = getAuthToken();
      const response = await fetch('/api/v1/export', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        let msg = 'Export failed';
        try {
          const body = await response.json();
          if (body?.error?.message) msg = body.error.message;
        } catch { /* ignore parse errors */ }
        throw new Error(msg);
      }
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'galipo_export.json';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const linkClasses = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-600 text-white'
        : 'text-text-secondary hover:bg-bg-hover hover:text-text'
    }`;

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64
          bg-bg-surface text-text
          flex flex-col border-r border-border
          transition-transform duration-300 ease-in-out
          md:sticky md:top-0 md:h-screen md:w-56
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo - matches header height and style */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <span className="font-semibold text-lg">Case Manager</span>
          </Link>
          {/* Close button - mobile only */}
          <button
            onClick={onMobileClose}
            className="p-2 -mr-2 text-text-muted hover:text-text md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                {item.children ? (
                  <>
                    <div className={`flex items-center rounded-lg text-sm font-medium transition-colors w-full ${
                        location.pathname.startsWith(item.href)
                          ? 'bg-primary-600 text-white'
                          : 'text-text-secondary hover:bg-bg-hover hover:text-text'
                      }`}
                    >
                      <button
                        onClick={() => {
                          navigate(item.href);
                          setOpenSections(prev => ({ ...prev, [item.href]: true }));
                          onMobileClose?.();
                        }}
                        className="flex items-center gap-3 flex-1 px-3 py-2 min-w-0"
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="flex-1 text-left">{item.name}</span>
                      </button>
                      <button
                        onClick={() => setOpenSections(prev => ({ ...prev, [item.href]: !prev[item.href] }))}
                        className="px-2 py-2 hover:opacity-70"
                      >
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openSections[item.href] ? 'rotate-90' : ''}`} />
                      </button>
                    </div>
                    {openSections[item.href] && (
                      <ul className="mt-1 ml-4 space-y-0.5 border-l border-border pl-3">
                        {item.children.map((child) => (
                          <li key={child.name}>
                            <NavLink
                              to={child.href}
                              onClick={onMobileClose}
                              className={({ isActive }) =>
                                `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                  isActive
                                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                                    : 'text-text-muted hover:bg-bg-hover hover:text-text'
                                }`
                              }
                            >
                              <child.icon className="w-3.5 h-3.5" />
                              {child.name}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <NavLink
                    to={item.href}
                    end={item.href === '/'}
                    onClick={onMobileClose}
                    className={({ isActive }) => linkClasses(isActive)}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className={`w-5 h-5 ${isExporting ? 'animate-pulse' : ''}`} />
            {isExporting ? 'Exporting...' : 'Export Data'}
          </button>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text rounded-lg transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        {/* User Profile */}
        <div className="p-3 border-t border-border">
          <ProfileDropdown />
        </div>
      </aside>
    </>
  );
}
