import { useNavigate } from 'react-router-dom';
import { Briefcase, Inbox, CheckSquare, Clock, FileText, Webhook, Users, MessageCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Feature {
  key: string;
  name: string;
  description: string;
  icon: LucideIcon;
  route: string | null;
}

const FEATURES: Feature[] = [
  { key: 'cases', name: 'Cases', description: 'Manage case files and matters', icon: Briefcase, route: '/cases' },
  { key: 'intakes', name: 'Intake', description: 'Review new client inquiries', icon: Inbox, route: '/intakes' },
  { key: 'tasks', name: 'Tasks', description: 'Track to-dos and assignments', icon: CheckSquare, route: '/tasks' },
  { key: 'calendar', name: 'Calendar', description: 'Upcoming events and deadlines', icon: Clock, route: '/calendar' },
  { key: 'templates', name: 'Templates', description: 'Generate pleadings, RFPs, and more', icon: FileText, route: '/templates' },
  { key: 'courtlistener', name: 'CourtListener', description: 'Monitor federal court filings', icon: Webhook, route: '/courtlistener' },
  { key: 'people', name: 'People', description: 'Contacts, clients, counsel, and experts', icon: Users, route: '/persons' },
  { key: 'chat', name: 'Chat', description: 'AI assistant for case research', icon: MessageCircle, route: null },
];

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const firstName = user?.firstName ?? 'there';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const allEnabled = user?.isAdmin || user?.visibleFeatures == null;
  const enabledFeatures = allEnabled
    ? FEATURES
    : FEATURES.filter((f) => user?.visibleFeatures?.[f.key] !== false);
  const disabledFeatures = allEnabled
    ? []
    : FEATURES.filter((f) => user?.visibleFeatures?.[f.key] === false);

  return (
    <div className="h-screen flex flex-col overflow-auto bg-bg-base">
      {/* Greeting */}
      <div className="px-6 pt-8 pb-2">
        <h1 className="text-2xl font-semibold text-text">Welcome back, {firstName}</h1>
        <p className="text-text-muted mt-1">{today}</p>
      </div>

      {/* Your Tools */}
      <div className="px-6 pt-6">
        <h2 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-4">Your Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enabledFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <button
                key={feature.key}
                onClick={() => feature.route && navigate(feature.route)}
                className="flex items-start gap-4 p-4 rounded-lg bg-bg-surface border border-border hover:border-primary-300 hover:shadow transition-all text-left cursor-pointer"
              >
                <div className="p-2 rounded-md bg-primary-50 dark:bg-primary-950">
                  <Icon className="w-5 h-5 text-primary-500" />
                </div>
                <div>
                  <div className="font-medium text-text">{feature.name}</div>
                  <div className="text-sm text-text-muted mt-0.5">{feature.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* More Tools Available (only for restricted users) */}
      {disabledFeatures.length > 0 && (
        <div className="px-6 pt-8 pb-8">
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-1">More Tools Available</h2>
          <p className="text-xs text-text-muted mb-4">Contact your admin to get access</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {disabledFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.key}
                  className="flex items-start gap-4 p-4 rounded-lg bg-bg-surface border border-border opacity-50"
                >
                  <div className="p-2 rounded-md bg-bg-muted">
                    <Icon className="w-5 h-5 text-text-muted" />
                  </div>
                  <div>
                    <div className="font-medium text-text-muted">{feature.name}</div>
                    <div className="text-sm text-text-muted mt-0.5">{feature.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
