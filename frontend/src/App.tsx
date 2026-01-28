import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/layout';
import { Dashboard, Cases, CaseDetail, Tasks, Calendar, Webhooks, WebhookDetail, Login } from './pages';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { EntityModalProvider } from './context/EntityModalContext';
import { DragProvider } from './context/DragContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { EntityDetailModal } from './components/modals';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <DragProvider>
          <EntityModalProvider>
            <AuthProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Dashboard />} />
                    <Route path="cases" element={<Cases />} />
                    <Route path="cases/:id" element={<CaseDetail />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="calendar" element={<Calendar />} />
                    <Route path="courtlistener" element={<Webhooks />} />
                    <Route path="courtlistener/:id" element={<WebhookDetail />} />
                  </Route>
                </Routes>
              </BrowserRouter>
              <EntityDetailModal />
            </AuthProvider>
          </EntityModalProvider>
        </DragProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
