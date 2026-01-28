import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  Clock,
  Scale,
  Download,
  Webhook,
} from 'lucide-react';
import { useState } from 'react';
import { getAuthToken } from '../../context/AuthContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Cases', href: '/cases', icon: Briefcase },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Calendar', href: '/calendar', icon: Clock },
  { name: 'CourtListener', href: '/courtlistener', icon: Webhook },
];

export function Sidebar() {
  const [isExporting, setIsExporting] = useState(false);

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
        throw new Error('Export failed');
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
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <aside className="w-56 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex flex-col min-h-screen border-r border-slate-200 dark:border-transparent transition-colors">
      {/* Logo - matches header height and style */}
      <div className="h-16 px-4 flex items-center border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <div className="flex items-center gap-2">
          <Scale className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <span className="font-semibold text-lg">Case Manager</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} />
          {isExporting ? 'Exporting...' : 'Export Data'}
        </button>
      </div>
    </aside>
  );
}
