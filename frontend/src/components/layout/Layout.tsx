import { useState, useEffect } from 'react';
import { Outlet, useMatch } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ChatButton, ChatPanel } from '../chat';
import { DocketButton, DocketPanel } from '../docket';
import { QuickCaseSearch } from '../common';

export function Layout() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDocketOpen, setIsDocketOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);

  // Detect if we're on a case detail page and extract case ID
  const caseMatch = useMatch('/cases/:id');
  const caseContext = caseMatch?.params.id ? parseInt(caseMatch.params.id, 10) : undefined;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shift+Cmd+K (Mac) / Shift+Ctrl+K (Windows) to open quick case search
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen((prev) => !prev);
        return;
      }
      // Shift+Cmd+D (Mac) / Shift+Ctrl+D (Windows) to toggle docket
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        setIsDocketOpen((prev) => !prev);
        return;
      }
      // Cmd+K (Mac) / Ctrl+K (Windows) to toggle chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>

      {/* Chat UI */}
      <ChatButton onClick={() => setIsChatOpen(true)} isOpen={isChatOpen} />
      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} caseContext={caseContext} />

      {/* Daily Docket */}
      <DocketButton onClick={() => setIsDocketOpen(true)} isOpen={isDocketOpen} />
      <DocketPanel isOpen={isDocketOpen} onClose={() => setIsDocketOpen(false)} />

      {/* Quick Case Search */}
      <QuickCaseSearch isOpen={isQuickSearchOpen} onClose={() => setIsQuickSearchOpen(false)} />
    </div>
  );
}
