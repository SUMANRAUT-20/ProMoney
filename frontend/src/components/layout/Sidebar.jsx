import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  ChartNoAxesColumn,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CreditCard,
  FlaskConical,
  FolderKanban,
  Goal,
  Landmark,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings2,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './sidebar.css';

const planItems = [
  { to: '/budgets', title: 'Budgets', icon: ChartNoAxesColumn },
  { to: '/bills', title: 'Bills & Subscriptions', icon: Receipt },
  { to: '/goals', title: 'Savings Goals', icon: Goal },
  { to: '/loans', title: 'Loans', icon: Landmark },
];

/**
 * Sidebar Navigation — Locked per Constitution P5:
 * Home · Transactions · My Accounts · My Plans ▸ (Budgets · Bills &
 * Subscriptions · Savings Goals · Loans) · Reports & Insights ·
 * ProMoney LA-BO (with AI badge) · Settings (bottom).
 */
export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const isPlanActive = planItems.some((item) => location.pathname.startsWith(item.to));
  const [plansOpen, setPlansOpen] = useState(true);

  const initials = user?.display_name
    ? user.display_name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'PM';

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logout();
    if (onNavigate) onNavigate();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="sidebar">
      <NavLink to="/home" className="brand" aria-label="ProMoney home" onClick={onNavigate}>
        <div className="brand-logo">¥</div>
        <span>ProMoney</span>
      </NavLink>

      <nav className="nav" aria-label="Main navigation">
        <NavLink
          to="/home"
          onClick={onNavigate}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={17} strokeWidth={1.9} />
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/transactions"
          onClick={onNavigate}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <ArrowLeftRight size={17} strokeWidth={1.9} />
          <span>Transactions</span>
        </NavLink>

        <NavLink
          to="/my-accounts"
          onClick={onNavigate}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Wallet size={17} strokeWidth={1.9} />
          <span>My Accounts</span>
        </NavLink>

        <div className="nav-group">
          <button
            type="button"
            className={`nav-item nav-group-toggle ${isPlanActive ? 'group-active' : ''}`}
            aria-expanded={plansOpen}
            onClick={() => setPlansOpen((open) => !open)}
          >
            <FolderKanban size={17} strokeWidth={1.9} />
            <span>My Plans</span>
            {plansOpen ? (
              <ChevronDown size={15} className="nav-group-chevron" />
            ) : (
              <ChevronRight size={15} className="nav-group-chevron" />
            )}
          </button>

          {plansOpen && (
            <div className="nav-subitems" role="group" aria-label="My Plans submenu">
              {planItems.map(({ to, title, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onNavigate}
                  className={({ isActive }) => `nav-item nav-subitem ${isActive ? 'active' : ''}`}
                >
                  <Icon size={15} strokeWidth={1.9} />
                  <span>{title}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <NavLink
          to="/reports-insights"
          onClick={onNavigate}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <CreditCard size={17} strokeWidth={1.9} />
          <span>Reports &amp; Insights</span>
        </NavLink>

        <NavLink
          to="/labo"
          onClick={onNavigate}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <FlaskConical size={17} strokeWidth={1.9} />
          <span>Nidhi</span>
          <span className="nav-ai-badge" aria-label="AI feature">
            AI
          </span>
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) => `nav-item sidebar-settings-link ${isActive ? 'active' : ''}`}
        >
          <Settings2 size={17} strokeWidth={1.9} />
          <span>Settings</span>
        </NavLink>

        {user && (
          <div className="sidebar-auth-links sidebar-profile-wrap" aria-label="Account">
            {profileMenuOpen && (
              <div className="sidebar-profile-menu" role="menu" aria-label="Profile menu">
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
