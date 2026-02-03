import { Loader2 } from 'lucide-react';

interface ListPanelProps {
  children: React.ReactNode;
  className?: string;
}

interface ListPanelHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface ListPanelBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface ListPanelRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  highlight?: boolean;
}

interface ListPanelEmptyProps {
  message?: string;
}

interface ListPanelLoadingProps {
  message?: string;
}

export function ListPanel({ children, className = '' }: ListPanelProps) {
  return (
    <div className={`bg-bg-surface rounded-lg border border-border shadow-sm transition-colors ${className}`}>
      {children}
    </div>
  );
}

ListPanel.Header = function ListPanelHeader({ children, className = '' }: ListPanelHeaderProps) {
  return (
    <div className={`px-4 py-3 border-b border-border ${className}`}>
      {children}
    </div>
  );
};

ListPanel.Body = function ListPanelBody({ children, className = '' }: ListPanelBodyProps) {
  return (
    <div className={`divide-y divide-white/5 ${className}`}>
      {children}
    </div>
  );
};

ListPanel.Row = function ListPanelRow({ children, className = '', onClick, highlight = false }: ListPanelRowProps) {
  return (
    <div
      onClick={onClick}
      className={`
        px-4 py-3 flex items-center gap-4
        hover:bg-bg-hover transition-colors
        ${onClick ? 'cursor-pointer' : ''}
        ${highlight ? 'bg-red-50 dark:bg-red-900/20' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

ListPanel.Empty = function ListPanelEmpty({ message = 'No items' }: ListPanelEmptyProps) {
  return (
    <div className="px-4 py-8 text-center text-text-muted">
      {message}
    </div>
  );
};

ListPanel.Loading = function ListPanelLoading({ message }: ListPanelLoadingProps) {
  return (
    <div className="px-4 py-8 flex flex-col items-center justify-center gap-2 text-text-muted">
      <Loader2 className="w-6 h-6 animate-spin" />
      {message && <span className="text-sm">{message}</span>}
    </div>
  );
};
