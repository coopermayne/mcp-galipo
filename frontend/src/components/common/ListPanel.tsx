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
    <div className={`bg-slate-800 rounded-lg border border-slate-700 ${className}`}>
      {children}
    </div>
  );
}

ListPanel.Header = function ListPanelHeader({ children, className = '' }: ListPanelHeaderProps) {
  return (
    <div className={`px-4 py-3 border-b border-slate-700 ${className}`}>
      {children}
    </div>
  );
};

ListPanel.Body = function ListPanelBody({ children, className = '' }: ListPanelBodyProps) {
  return (
    <div className={`divide-y divide-slate-700 ${className}`}>
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
        hover:bg-slate-700/50 transition-colors
        ${onClick ? 'cursor-pointer' : ''}
        ${highlight ? 'bg-red-900/20' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

ListPanel.Empty = function ListPanelEmpty({ message = 'No items' }: ListPanelEmptyProps) {
  return (
    <div className="px-4 py-8 text-center text-slate-400">
      {message}
    </div>
  );
};

ListPanel.Loading = function ListPanelLoading({ message }: ListPanelLoadingProps) {
  return (
    <div className="px-4 py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin" />
      {message && <span className="text-sm">{message}</span>}
    </div>
  );
};
