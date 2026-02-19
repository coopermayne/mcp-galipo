import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/layout';
import { Dashboard, Cases, CaseDetail, Tasks, Calendar, Intakes, ArchivedIntakes, Webhooks, WebhookDetail, Login, PersonsIndex, ClientsPage, CounselPage, ExpertsPage, DefendantsPage, MediatorsPage, JudgesPage, OtherPage, Users, TemplatesIndex, Pleadings, RFP, CaseList, Retainer, Disbursement } from './pages';
import { ObjectionsManager } from './pages/templates';
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
                    <Route path="intakes" element={<Intakes />} />
                    <Route path="intakes/archived" element={<ArchivedIntakes />} />
                    <Route path="cases" element={<Cases />} />
                    <Route path="cases/:id" element={<CaseDetail />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="calendar" element={<Calendar />} />
                    <Route path="courtlistener" element={<Webhooks />} />
                    <Route path="courtlistener/:id" element={<WebhookDetail />} />
                    <Route path="persons" element={<PersonsIndex />} />
                    <Route path="persons/clients" element={<ClientsPage />} />
                    <Route path="persons/counsel" element={<CounselPage />} />
                    <Route path="persons/experts" element={<ExpertsPage />} />
                    <Route path="persons/defendants" element={<DefendantsPage />} />
                    <Route path="persons/mediators" element={<MediatorsPage />} />
                    <Route path="persons/judges" element={<JudgesPage />} />
                    <Route path="persons/other" element={<OtherPage />} />
                    <Route path="users" element={<Users />} />
                    <Route path="templates" element={<TemplatesIndex />} />
                    <Route path="templates/pleadings" element={<Pleadings />} />
                    <Route path="templates/rfp" element={<RFP />} />
                    <Route path="templates/rfp/objections" element={<ObjectionsManager />} />
                    <Route path="templates/case-list" element={<CaseList />} />
                    <Route path="templates/retainer" element={<Retainer />} />
                    <Route path="templates/disbursement" element={<Disbursement />} />
                  </Route>
                </Routes>
                <EntityDetailModal />
              </BrowserRouter>
            </AuthProvider>
          </EntityModalProvider>
        </DragProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
