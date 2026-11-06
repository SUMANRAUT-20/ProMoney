import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Menu, LogOut } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { clearSession, getSessionUser } from '../../services/api';

export default function Topbar({ toggleMenu }) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { theme, setTheme } = useFinance();
  const user = getSessionUser();
  const initials = (user?.display_name || '')
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const logout = () => {
    clearSession();
    navigate('/login');
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
        {user ? (
          <>
            <span className="avatar" title={user.display_name}>{initials || 'PM'}</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Log out"
              title="Log out"
              onClick={logout}
            >
              <LogOut size={19} />
            </button>
          </>
        ) : (
          <Link to="/login" className="avatar" aria-label="Sign in to user account" title="Sign In">
            PM
          </Link>
        )}
      </div>
    </header>
  );
}
