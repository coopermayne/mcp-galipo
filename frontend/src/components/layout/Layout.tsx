import { useState, useEffect } from 'react';
import { Outlet, useMatch } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ChatButton, ChatPanel } from '../chat';

export function Layout() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Detect if we're on a case detail page and extract case ID
  const caseMatch = useMatch('/cases/:id');
  const caseContext = caseMatch?.params.id ? parseInt(caseMatch.params.id, 10) : undefined;

  // Keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Windows) to toggle chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    </div>
  );
}
