import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, useMatch, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ChatButton, ChatPanel } from '../chat';
import { QuickCaseSearch } from '../common';

// Detect if running on Mac
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

// Context for mobile sidebar state
interface MobileSidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

const MobileSidebarContext = createContext<MobileSidebarContextType>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
});

export const useMobileSidebar = () => useContext(MobileSidebarContext);

export function Layout() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  const mobileSidebarContext: MobileSidebarContextType = {
    isOpen: isMobileSidebarOpen,
    toggle: () => setIsMobileSidebarOpen(prev => !prev),
    close: () => setIsMobileSidebarOpen(false),
  };

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
    <MobileSidebarContext.Provider value={mobileSidebarContext}>
      <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors">
        <Sidebar
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>

        {/* Chat UI */}
        <ChatButton onClick={() => setIsChatOpen(true)} isOpen={isChatOpen} />
        <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} caseContext={caseContext} />

        {/* Quick Case Search */}
        <QuickCaseSearch isOpen={isQuickSearchOpen} onClose={() => setIsQuickSearchOpen(false)} />
      </div>
    </MobileSidebarContext.Provider>
  );
}
