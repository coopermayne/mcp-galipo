interface PageContentProps {
  children: React.ReactNode;
  /**
   * Layout variant:
   * - "full": No max-width constraint, content uses available space
   * - "constrained": Max-width applied, content left-aligned
   */
  variant?: 'full' | 'constrained';
  className?: string;
}

export function PageContent({ children, variant = 'constrained', className = '' }: PageContentProps) {
  const variantClasses = {
    full: '',
    constrained: 'max-w-5xl', // ~1024px - good balance for lists and tables
  };

  return (
    <div className={`flex-1 overflow-auto p-6 ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
