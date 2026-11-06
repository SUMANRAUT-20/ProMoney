import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Menu, LogOut } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';

export default function Topbar({ toggleMenu }) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { theme, setTheme } = useFinance();
  const { user, logout } = useAuth();

  const initials = user?.display_name
    ? user.display_name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    : 'PM';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const submit = (event) => {
    event.preventDefault();
    if (search.trim()) {
      navigate(`/transactions?search=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="icon-button mobile-menu"
          type="button"
          aria-label="Toggle menu"
          onClick={toggleMenu}
        >
          <Menu size={20} />
        </button>
        <span className="topbar-title">Financial Workspace (JPY)</span>
      </div>

      <div className="topbar-right">
        <form className="search" onSubmit={submit}>
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions..."
            aria-label="Search transactions"
          />
          <kbd>↵</kbd>
        </form>
        <button
          type="button"
          className="icon-button"
          aria-label="Toggle theme mode"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <Link
          to="/settings"
          className="avatar"
          aria-label={user ? `Signed in as ${user.display_name}` : 'Sign in to user account'}
          title={user ? user.display_name : 'Sign In'}
        >
          {initials}
        </Link>
        {user && (
          <button
            type="button"
            className="icon-button"
            aria-label="Log out"
            title="Log out"
            onClick={handleLogout}
          >
            <LogOut size={19} />
          </button>
        )}
      </div>
    </header>
  );
}
