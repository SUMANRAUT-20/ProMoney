import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Menu } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/api';
import './topbar.css';

/**
 * Topbar — search, workspace currency label, live date & time, theme.
 * Profile and Log out live in the Sidebar only (moved 2026-11-06 at
 * Arpan's request); the clock's date follows the Settings date-format
 * preference and the time updates every second (browser local time).
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateByPreference(date, format) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  switch (format) {
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${yyyy}`;
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'DD MMM YYYY':
      return `${dd} ${MONTHS_SHORT[date.getMonth()]} ${yyyy}`;
    case 'YYYY-MM-DD':
    default:
      return `${yyyy}-${mm}-${dd}`;
  }
}

function HeaderClock({ dateFormat }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (n) => String(n).padStart(2, '0');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  return (
    <div className="topbar-clock" aria-label="Current date and time">
      <span className="topbar-clock-date">
        {WEEKDAYS[now.getDay()]}, {formatDateByPreference(now, dateFormat)}
      </span>
      <span className="topbar-clock-time">{time}</span>
    </div>
  );
}

export default function Topbar({ toggleMenu }) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { theme, setTheme, preferences, setPreferences } = useFinance();
  const { user, updateUser } = useAuth();

  // Account settings integration: right after sign-in (and on session
  // restore), load the settings saved on the account and apply them —
  // theme, currency/date format, and the profile photo — so they are
  // still there at the next login, on any browser. Runs once per user.
  const loadedForUserRef = useRef(null);
  useEffect(() => {
    if (!user?.id || loadedForUserRef.current === user.id) return;
    loadedForUserRef.current = user.id;
    apiClient
      .getSettings()
      .then((payload) => {
        const { profile, preferences: saved } = payload.data;
        if (saved.theme) setTheme(saved.theme);
        setPreferences({ currency: saved.currency, date_format: saved.date_format });
        updateUser({ avatar_data_url: profile.avatar_data_url || null });
      })
      .catch(() => {
        // Backend unreachable or session expired — keep the local
        // theme/preferences; AuthContext handles an expired session.
      });
  }, [user?.id, setTheme, setPreferences, updateUser]);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (user) {
      // Save to the account too, so the choice survives the next login.
      apiClient.updatePreferences({ theme: next }).catch(() => {});
    }
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
        <span className="topbar-title">Financial Workspace ({preferences.currency})</span>
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
        <HeaderClock dateFormat={preferences.date_format} />
        <button
          type="button"
          className="icon-button"
          aria-label="Toggle theme mode"
          onClick={toggleTheme}
        >
          {theme === 'light' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </div>
    </header>
  );
}
