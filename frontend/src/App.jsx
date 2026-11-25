import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './features/auth/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';

// Modular Feature Views (Locked Navigation per Constitution P5)
import DashboardView from './features/dashboard/DashboardView';
import TransactionsView from './features/transactions/TransactionsView';
import AccountsView from './features/accounts/AccountsView';
import BudgetsView from './features/budgets/BudgetsView';
import BillsView from './features/bills/BillsView';
import GoalsView from './features/goals/GoalsView';
import LoansView from './features/loans/LoansView';
import ReportsView from './features/analytics/ReportsView';
import LaboView from './features/labo/LaboView';
import SettingsView from './features/settings/SettingsView';
import AuthView from './features/auth/AuthView';

const LandingPage = lazy(() => import('./features/landing/LandingPage'));

function WorkspaceLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isDemo, resetDemoData } = useFinance();

  return (
    <div className="app-shell">
      <div className={`side-layer ${menuOpen ? 'show' : ''}`}>
        <Sidebar onNavigate={() => setMenuOpen(false)} />
      </div>

      {menuOpen && (
        <button
          className="mobile-scrim"
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="app-main">
        <Topbar toggleMenu={() => setMenuOpen((open) => !open)} />
        <main className="content" onClick={() => menuOpen && setMenuOpen(false)}>
          {isDemo && (
            <div
              className="status-banner"
              role="status"
              aria-label="Sample data demo account notice"
              style={{ marginBottom: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}
            >
              <div>
                <strong>Sample data</strong>
                <span>
                  You are viewing the Demo Account — all figures on this screen are sample data only and kept separate from real user accounts.
                </span>
              </div>
              <button
                type="button"
                className="btn secondary compact"
                onClick={resetDemoData}
              >
                Reset sample data
              </button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<DashboardView />} />
            <Route path="/dashboard" element={<Navigate to="/home" replace />} />
            <Route path="/transactions" element={<TransactionsView />} />
            <Route path="/my-accounts" element={<AccountsView />} />
            <Route path="/accounts" element={<Navigate to="/my-accounts" replace />} />
            <Route path="/budgets" element={<BudgetsView />} />
            <Route path="/bills" element={<BillsView />} />
            <Route path="/goals" element={<GoalsView />} />
            <Route path="/loans" element={<LoansView />} />
            <Route path="/reports-insights" element={<ReportsView />} />
            <Route path="/reports" element={<Navigate to="/reports-insights" replace />} />
            <Route path="/labo" element={<LaboView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function LandingEntry({ sessionAvailable = false }) {
  return <Suspense fallback={null}><LandingPage sessionAvailable={sessionAvailable} /></Suspense>;
}

function RootEntry() {
  const { user, isCheckingSession } = useAuth();
  if (isCheckingSession) return <p role="status">Checking your session…</p>;
  return <ResolvedRootEntry signedIn={Boolean(user)} />;
}

function ResolvedRootEntry({ signedIn }) {
  // The auth view needs to show its confirmation before it navigates.
  const [startedSignedIn] = useState(signedIn);
  return startedSignedIn ? <Navigate to="/home" replace /> : <LandingEntry sessionAvailable />;
}

function AuthRoute({ signup }) {
  const [params] = useSearchParams();
  if (!signup && params.get('view') === 'welcome') return <Navigate to="/" replace />;
  return <main className="pm-auth-page"><AuthView signup={signup} /></main>;
}

function AppRoutes() {
  return (
    <FinanceProvider>
      <Routes>
        <Route path="/login" element={<AuthRoute />} />
        <Route path="/register" element={<AuthRoute signup />} />
        <Route path="/*" element={<ProtectedRoute><WorkspaceLayout /></ProtectedRoute>} />
      </Routes>
    </FinanceProvider>
  );
}

function SessionRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootEntry />} />
        <Route path="/*" element={<AppRoutes />} />
      </Routes>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<LandingEntry />} />
        <Route path="/*" element={<SessionRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
