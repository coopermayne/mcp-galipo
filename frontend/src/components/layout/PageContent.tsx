interface PageContentProps {
  children: React.ReactNode;
  /**
   * Layout variant:
   * - "full": Multi-column content, uses available width (Dashboard grids, CaseDetail overview)
   * - "narrow": Single-column content, max-width with centering (tables, lists, forms)
   * - "wide": Single-column but wider max-width (for wider tables)
   */
  variant?: 'full' | 'narrow' | 'wide';
  className?: string;
}

export function PageContent({ children, variant = 'full', className = '' }: PageContentProps) {
  const variantClasses = {
    full: '', // No max-width, uses full available space
    narrow: 'max-w-4xl mx-auto', // ~896px - good for forms, narrow lists
    wide: 'max-w-6xl mx-auto', // ~1152px - good for tables
  };

  return (
    <div className={`flex-1 overflow-auto p-6 ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
