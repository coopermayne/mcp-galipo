import { Receipt } from 'lucide-react';
import { Header, PageContent } from '../../components/layout';

export function Disbursement() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header title="Disbursement" subtitle="Settlement disbursement sheets" />

      <PageContent variant="full" className="scrollbar-hide">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-2xl bg-primary-50 dark:bg-primary-900/20 mb-4">
            <Receipt className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-lg font-semibold text-text mb-2">Coming Soon</h2>
          <p className="text-sm text-text-muted max-w-md">
            Generate disbursement sheets for settled cases — attorney fees, costs, liens, and net client recovery.
          </p>
        </div>
      </PageContent>
    </div>
  );
}
