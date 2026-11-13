import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  ChartNoAxesColumn,
  ChevronUp,
  CreditCard,
  FlaskConical,
  Goal,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings2,
  Wallet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './sidebar.css';

const items = [
  { to: '/dashboard', title: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', title: 'Transactions', icon: ArrowLeftRight },
  { to: '/accounts', title: 'Accounts', icon: Wallet },
  { to: '/budgets', title: 'Budgets', icon: ChartNoAxesColumn },
  { to: '/bills', title: 'Bills & Subscriptions', icon: Receipt },
  { to: '/goals', title: 'Savings Goals', icon: Goal },
  { to: '/reports', title: 'Reports', icon: CreditCard },
  { to: '/labo', title: 'ProMoney LA-BO', icon: FlaskConical },
];

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const initials = user?.display_name
    ? user.display_name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    : 'PM';

  const handleLogout = () => {
    setProfileMenuOpen(false);
    logout();
    if (onNavigate) onNavigate();
    navigate('/login', { replace: true });
  };

  const goToSettings = () => {
    setProfileMenuOpen(false);
    if (onNavigate) onNavigate();
    navigate('/settings');
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
        {user && (
          <div className="sidebar-auth-links sidebar-profile-wrap" aria-label="Account">
            {profileMenuOpen && (
              <div className="sidebar-profile-menu" role="menu" aria-label="Profile menu">
                <button type="button" className="nav-item" role="menuitem" onClick={goToSettings}>
                  <Settings2 size={16} strokeWidth={1.9} />
                  <span>Settings</span>
                </button>
                <button type="button" className="nav-item" role="menuitem" onClick={handleLogout}>
                  <LogOut size={16} strokeWidth={1.9} />
                  <span>Log out</span>
                </button>
              </div>
            )}
            <button
              type="button"
              className="nav-item sidebar-profile"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label={`Signed in as ${user.display_name} — open profile menu`}
              title={user.email}
              onClick={() => setProfileMenuOpen((open) => !open)}
            >
              <span className="avatar" aria-hidden="true">
                {user.avatar_data_url ? (
                  <img src={user.avatar_data_url} alt="" />
                ) : (
                  initials
                )}
              </span>
              <span className="sidebar-profile-text">
                <span className="sidebar-profile-name">{user.display_name}</span>
                <span className="sidebar-profile-email">{user.email}</span>
              </span>
              <ChevronUp
                size={15}
                strokeWidth={1.9}
                className={profileMenuOpen ? 'sidebar-profile-chevron open' : 'sidebar-profile-chevron'}
                aria-hidden="true"
              />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
