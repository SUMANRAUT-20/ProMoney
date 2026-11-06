import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { FinanceProvider } from './context/FinanceContext';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';

// Modular Feature Views (Clean Foundation)
import DashboardView from './features/dashboard/DashboardView';
import TransactionsView from './features/transactions/TransactionsView';
import AccountsView from './features/accounts/AccountsView';
import BudgetsView from './features/budgets/BudgetsView';
import BillsView from './features/bills/BillsView';
import GoalsView from './features/goals/GoalsView';
import ReportsView from './features/analytics/ReportsView';
import LaboView from './features/labo/LaboView';
import SettingsView from './features/settings/SettingsView';
import LoginView from './features/auth/LoginView';
import RegisterView from './features/auth/RegisterView';
import { hasSession } from './services/api';

// The workspace is private: without a saved login token, go to /login.
// The token itself is verified by the backend on every API call.
function RequireAuth({ children }) {
  return hasSession() ? children : <Navigate to="/login" replace />;
}

// Signed-in users do not need the login/register pages again.
function GuestOnly({ children }) {
  return hasSession() ? <Navigate to="/dashboard" replace /> : children;
}

function WorkspaceLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

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
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/transactions" element={<TransactionsView />} />
            <Route path="/accounts" element={<AccountsView />} />
            <Route path="/budgets" element={<BudgetsView />} />
            <Route path="/bills" element={<BillsView />} />
            <Route path="/goals" element={<GoalsView />} />
            <Route path="/reports" element={<ReportsView />} />
            <Route path="/labo" element={<LaboView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <FinanceProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestOnly><LoginView /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><RegisterView /></GuestOnly>} />
          <Route path="/*" element={<RequireAuth><WorkspaceLayout /></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </FinanceProvider>
  );
}
