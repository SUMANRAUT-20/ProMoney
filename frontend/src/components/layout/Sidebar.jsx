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
  LogIn,
  LogOut,
  Receipt,
  Settings2,
  UserPlus,
  Wallet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import './sidebar.css';

const items = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight },
  { to: '/accounts', labelKey: 'nav.accounts', icon: Wallet },
  { to: '/budgets', labelKey: 'nav.budgets', icon: ChartNoAxesColumn },
  { to: '/bills', labelKey: 'nav.bills', icon: Receipt },
  { to: '/goals', labelKey: 'nav.goals', icon: Goal },
  { to: '/reports', labelKey: 'nav.reports', icon: CreditCard },
  { to: '/labo', labelKey: 'nav.labo', icon: FlaskConical },
];

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const { t } = useFinance();
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
      <NavLink to="/dashboard" className="brand" aria-label={t('nav.home')}>
        <div className="brand-logo">¥</div>
        <span>ProMoney</span>
      </NavLink>

      <nav className="nav" aria-label={t('nav.main')}>
        {items.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={17} strokeWidth={1.9} />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {user ? (
          <div className="sidebar-auth-links sidebar-profile-wrap" aria-label={t('nav.account')}>
            {profileMenuOpen && (
              <div className="sidebar-profile-menu" role="menu" aria-label={t('nav.profileMenu')}>
                <button type="button" className="nav-item" role="menuitem" onClick={goToSettings}>
                  <Settings2 size={16} strokeWidth={1.9} />
                  <span>{t('nav.settings')}</span>
                </button>
                <button type="button" className="nav-item" role="menuitem" onClick={handleLogout}>
                  <LogOut size={16} strokeWidth={1.9} />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            )}
            <button
              type="button"
              className="nav-item sidebar-profile"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label={t('nav.signedInAs', { name: user.display_name })}
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
        ) : (
          <div className="sidebar-auth-links" aria-label={t('nav.authNav')}>
            <NavLink
              to="/login"
              onClick={onNavigate}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <LogIn size={16} strokeWidth={1.9} />
              <span>{t('nav.login')}</span>
            </NavLink>
            <NavLink
              to="/register"
              onClick={onNavigate}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <UserPlus size={16} strokeWidth={1.9} />
              <span>{t('nav.register')}</span>
            </NavLink>
          </div>
        )}
      </div>
    </aside>
  );
}
