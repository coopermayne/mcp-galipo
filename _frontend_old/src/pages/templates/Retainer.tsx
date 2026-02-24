import { FileSignature } from 'lucide-react';
import { Header, PageContent } from '../../components/layout';

export function Retainer() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header title="Retainer" subtitle="Retainer agreement generator" />

      <PageContent variant="full" className="scrollbar-hide">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-2xl bg-primary-50 dark:bg-primary-900/20 mb-4">
            <FileSignature className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-lg font-semibold text-text mb-2">Coming Soon</h2>
          <p className="text-sm text-text-muted max-w-md">
            Create retainer agreements with pre-filled client and case information.
          </p>
        </div>
      </PageContent>
    </div>
  );
}
