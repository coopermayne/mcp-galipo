import { useState, useEffect } from 'react';
import { Outlet, useMatch } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ChatButton, ChatPanel } from '../chat';
import { DocketButton, DocketPanel } from '../docket';
import { QuickCaseSearch } from '../common';

// Detect if running on Mac
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export function Layout() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDocketOpen, setIsDocketOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);

  // Detect if we're on a case detail page and extract case ID
  const caseMatch = useMatch('/cases/:id');
  const caseContext = caseMatch?.params.id ? parseInt(caseMatch.params.id, 10) : undefined;

  // Keyboard shortcuts
  // Mac: Control + key
  // Windows: Alt + key (to avoid browser conflicts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for our modifier key (Control on Mac, Alt on Windows)
      const hasModifier = isMac ? e.ctrlKey : e.altKey;
      if (!hasModifier) return;

      const key = e.key.toLowerCase();

      // Ctrl+G (Mac) / Alt+G (Windows) - Quick case search
      if (key === 'g') {
        e.preventDefault();
        setIsQuickSearchOpen((prev) => !prev);
        return;
      }

      // Ctrl+D (Mac) / Alt+D (Windows) - Daily docket
      if (key === 'd') {
        e.preventDefault();
        setIsDocketOpen((prev) => !prev);
        return;
      }

      // Ctrl+K (Mac) / Alt+K (Windows) - Chat
      if (key === 'k') {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
        return;
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
