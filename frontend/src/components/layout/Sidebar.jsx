import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  ChartNoAxesColumn,
  CreditCard,
  FlaskConical,
  Goal,
  LayoutDashboard,
  LogIn,
  LogOut,
  Receipt,
  Settings2,
  UserPlus,
  Wallet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const items = [
  { to: '/dashboard', title: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', title: 'Transactions', icon: ArrowLeftRight },
  { to: '/accounts', title: 'Accounts', icon: Wallet },
  { to: '/budgets', title: 'Budgets', icon: ChartNoAxesColumn },
  { to: '/bills', title: 'Bills & Subscriptions', icon: Receipt },
  { to: '/goals', title: 'Savings Goals', icon: Goal },
  { to: '/reports', title: 'Reports', icon: CreditCard },
  { to: '/labo', title: 'ProMoney LA-BO', icon: FlaskConical },
  { to: '/settings', title: 'Settings', icon: Settings2 }
];

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    if (onNavigate) onNavigate();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="sidebar">
      <NavLink to="/dashboard" className="brand" aria-label="ProMoney home">
        <div className="brand-logo">¥</div>
        <span>ProMoney</span>
      </NavLink>

      <nav className="nav" aria-label="Main navigation">
        {items.map(({ to, title, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={17} strokeWidth={1.9} />
            <span>{title}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {user ? (
          <div className="sidebar-auth-links" aria-label="Account">
            <span className="nav-item" aria-label={`Signed in as ${user.display_name}`}>
              <span>{user.display_name}</span>
            </span>
            <button type="button" className="nav-item" onClick={handleLogout}>
              <LogOut size={16} strokeWidth={1.9} />
              <span>Log out</span>
            </button>
          </div>
        ) : (
          <div className="sidebar-auth-links" aria-label="Authentication navigation">
            <NavLink
              to="/login"
              onClick={onNavigate}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <LogIn size={16} strokeWidth={1.9} />
              <span>Login</span>
            </NavLink>
            <NavLink
              to="/register"
              onClick={onNavigate}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <UserPlus size={16} strokeWidth={1.9} />
              <span>Registration</span>
            </NavLink>
          </div>
        )}
      </div>
    </aside>
  );
}
