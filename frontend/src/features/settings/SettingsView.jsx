import { useEffect, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { PageHeading } from '../../components/ui';
import { apiClient } from '../../services/api';
import './settings.css';

/**
 * Settings & Preferences — fully customizable (Arpan, Settings)
 *
 * Preferences (theme, base currency, date format) and profile/security
 * are stored per user by the backend (/api/settings) and applied here:
 * theme via FinanceContext, currency + date format via FinanceContext
 * preferences (the Topbar workspace label reflects the currency).
 * Currency changes the workspace's display currency label only —
 * amounts are NOT converted (no exchange-rate source yet).
 */

const CURRENCIES = [
  { code: 'JPY', label: 'Japanese Yen (JPY, ¥)' },
  { code: 'USD', label: 'US Dollar (USD, $)' },
  { code: 'EUR', label: 'Euro (EUR, €)' },
  { code: 'GBP', label: 'British Pound (GBP, £)' },
  { code: 'NPR', label: 'Nepalese Rupee (NPR, Rs)' },
  { code: 'INR', label: 'Indian Rupee (INR, ₹)' },
  { code: 'AUD', label: 'Australian Dollar (AUD, $)' },
  { code: 'CAD', label: 'Canadian Dollar (CAD, $)' },
];

// Example labels use one fixed sample date: 6 November 2026.
const DATE_FORMATS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD — 2026-11-06' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY — 06/11/2026' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY — 11/06/2026' },
  { value: 'DD MMM YYYY', label: 'DD MMM YYYY — 06 Nov 2026' },
];

export default function SettingsView() {
  const { theme, setTheme, preferences, setPreferences } = useFinance();
  const { user, updateUser } = useAuth();

  const [loadError, setLoadError] = useState('');
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarMessage, setAvatarMessage] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [profileMessage, setProfileMessage] = useState(null);
  const [prefsMessage, setPrefsMessage] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getSettings()
      .then((payload) => {
        if (cancelled) return;
        const { profile: loadedProfile, preferences: loadedPrefs } = payload.data;
        setProfile(loadedProfile);
        setAvatarUrl(loadedProfile.avatar_data_url || null);
        setDisplayName(loadedProfile.display_name || '');
        if (loadedPrefs.theme && loadedPrefs.theme !== theme) setTheme(loadedPrefs.theme);
        setPreferences({ currency: loadedPrefs.currency, date_format: loadedPrefs.date_format });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err.status
              ? err.message
              : 'Could not reach the ProMoney server. Start the backend and reload this page.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // Load once on mount; theme/preferences application happens in the handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePreferences = async (partial) => {
    setPrefsMessage(null);
    try {
      const payload = await apiClient.updatePreferences(partial);
      const saved = payload.data.preferences;
      if (saved.theme) setTheme(saved.theme);
      setPreferences({ currency: saved.currency, date_format: saved.date_format });
      setPrefsMessage({ kind: 'success', text: 'Preferences saved.' });
    } catch (err) {
      setPrefsMessage({
        kind: 'error',
        text: err.status ? err.message : 'Could not reach the ProMoney server. Preference not saved.',
      });
    }
  };

  // Downscales the chosen image to a 128x128 square JPEG data URL on a
  // canvas, then saves it as the account avatar. Without a photo, the
  // sidebar shows the initials from the display name instead.
  const saveAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarMessage(null);
    try {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = objectUrl;
      });
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const side = Math.min(image.width, image.height);
      canvas
        .getContext('2d')
        .drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(objectUrl);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const payload = await apiClient.updateAvatar({ avatar_data_url: dataUrl });
      setAvatarUrl(payload.data.avatar_data_url);
      updateUser({ avatar_data_url: payload.data.avatar_data_url });
      setAvatarMessage({ kind: 'success', text: 'Profile photo saved.' });
    } catch (err) {
      setAvatarMessage({
        kind: 'error',
        text: err.status ? err.message : 'Could not save the photo. Is the backend running?',
      });
    }
  };

  const removeAvatar = async () => {
    setAvatarMessage(null);
    try {
      await apiClient.updateAvatar({ avatar_data_url: null });
      setAvatarUrl(null);
      updateUser({ avatar_data_url: null });
      setAvatarMessage({ kind: 'success', text: 'Profile photo removed — initials are shown instead.' });
    } catch (err) {
      setAvatarMessage({
        kind: 'error',
        text: err.status ? err.message : 'Could not reach the ProMoney server. Photo not removed.',
      });
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      const payload = await apiClient.updateProfile({ display_name: displayName.trim() });
      updateUser({ display_name: payload.data.user.display_name });
      setProfile((prev) => (prev ? { ...prev, display_name: payload.data.user.display_name } : prev));
      setProfileMessage({ kind: 'success', text: 'Profile saved.' });
    } catch (err) {
      setProfileMessage({
        kind: 'error',
        text: err.status ? err.message : 'Could not reach the ProMoney server. Profile not saved.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordMessage({ kind: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ kind: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    setSavingPassword(true);
    try {
      await apiClient.changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ kind: 'success', text: 'Password changed.' });
    } catch (err) {
      setPasswordMessage({
        kind: 'error',
        text: err.status ? err.message : 'Could not reach the ProMoney server. Password not changed.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <PageHeading
        title="Settings & Preferences"
        subtitle="Customize appearance, regional formats, and your account profile and security."
      />

      {loadError && (
        <section className="section-card card settings-card">
          <p className="settings-message error">{loadError}</p>
        </section>
      )}

      <section className="section-card card settings-card">
        <h2>Appearance &amp; Theme</h2>
        <p className="muted">Switch between Ultra-Clean Finance light and dark modes.</p>

        <div className="setting-row">
          <span>Theme Mode</span>
          <div className="segmented">
            <button
              type="button"
              className={theme === 'light' ? 'selected' : ''}
              onClick={() => { setTheme('light'); savePreferences({ theme: 'light' }); }}
            >
              Light
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'selected' : ''}
              onClick={() => { setTheme('dark'); savePreferences({ theme: 'dark' }); }}
            >
              Dark
            </button>
          </div>
        </div>

        <div className="setting-row">
          <span>Base Currency</span>
          <select
            className="settings-select"
            aria-label="Base currency"
            value={preferences.currency}
            onChange={(event) => {
              setPreferences({ currency: event.target.value });
              savePreferences({ currency: event.target.value });
            }}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.label}
              </option>
            ))}
          </select>
        </div>

        <div className="setting-row">
          <span>Calendar &amp; Date Format</span>
          <select
            className="settings-select"
            aria-label="Date format"
            value={preferences.date_format}
            onChange={(event) => {
              setPreferences({ date_format: event.target.value });
              savePreferences({ date_format: event.target.value });
            }}
          >
            {DATE_FORMATS.map((format) => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </select>
        </div>

        {prefsMessage && (
          <p className={`settings-message ${prefsMessage.kind}`}>{prefsMessage.text}</p>
        )}
      </section>

      <section className="section-card card settings-card">
        <h2>Account Profile</h2>
        <p className="muted">Your display name is shown in the sidebar and top bar.</p>

        <div className="setting-row">
          <span>Profile Photo</span>
          <div className="settings-control">
            <span className="avatar settings-avatar-preview" aria-hidden="true">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                (displayName || user?.display_name || 'PM')
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
              )}
            </span>
            <label className="settings-button settings-upload-button">
              Upload photo
              <input type="file" accept="image/*" hidden onChange={saveAvatarFile} />
            </label>
            {avatarUrl && (
              <button type="button" className="settings-button settings-button-secondary" onClick={removeAvatar}>
                Remove
              </button>
            )}
          </div>
        </div>
        <p className="muted">With no photo, the sidebar shows the initials from your display name.</p>
        {avatarMessage && (
          <p className={`settings-message ${avatarMessage.kind}`}>{avatarMessage.text}</p>
        )}

        <form onSubmit={saveProfile}>
          <div className="setting-row">
            <span>Display Name</span>
            <div className="settings-control">
              <input
                className="settings-input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={100}
                aria-label="Display name"
              />
              <button className="settings-button" type="submit" disabled={savingProfile || !displayName.trim()}>
                Save
              </button>
            </div>
          </div>
          <div className="setting-row">
            <span>Email</span>
            <span className="settings-readonly">{profile?.email || user?.email || '—'}</span>
          </div>
        </form>

        {profileMessage && (
          <p className={`settings-message ${profileMessage.kind}`}>{profileMessage.text}</p>
        )}
      </section>

      <section className="section-card card settings-card">
        <h2>Security</h2>
        <p className="muted">Change the password you use to sign in with email.</p>

        {profile && !profile.has_password ? (
          <div className="setting-row">
            <span>Password</span>
            <span className="settings-readonly">
              This account uses Google sign-in — there is no password to change.
            </span>
          </div>
        ) : (
          <form onSubmit={savePassword}>
            <div className="setting-row">
              <span>Change Password</span>
              <div className="settings-stack">
                <div className="settings-field">
                  <label htmlFor="settings-current-password">Current password</label>
                  <input
                    id="settings-current-password"
                    className="settings-input"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="settings-field">
                  <label htmlFor="settings-new-password">New password</label>
                  <input
                    id="settings-new-password"
                    className="settings-input"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="settings-field">
                  <label htmlFor="settings-confirm-password">Confirm new password</label>
                  <input
                    id="settings-confirm-password"
                    className="settings-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <button
                  className="settings-button"
                  type="submit"
                  disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                >
                  Change password
                </button>
              </div>
            </div>
          </form>
        )}

        {passwordMessage && (
          <p className={`settings-message ${passwordMessage.kind}`}>{passwordMessage.text}</p>
        )}
      </section>
    </>
  );
}
