import { useEffect, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { PageHeading } from '../../components/ui';
import { apiClient } from '../../services/api';
import { isLiabilityAccount } from '../../utils/financeMath';
import CategoriesSettings from './CategoriesSettings';
import NidhiMemorySettings from './NidhiMemorySettings';
import './settings.css';

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

const DATE_FORMATS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD — 2026-11-06' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY — 06/11/2026' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY — 11/06/2026' },
  { value: 'DD MMM YYYY', label: 'DD MMM YYYY — 06 Nov 2026' },
];

export default function SettingsView() {
  const { isDemo, accounts, theme, setTheme, preferences, setPreferences } = useFinance();
  const { user, updateUser } = useAuth();

  const [loadError, setLoadError] = useState('');
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarMessage, setAvatarMessage] = useState(null);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [profileMessage, setProfileMessage] = useState(null);
  const [prefsMessage, setPrefsMessage] = useState(null);
  const [engineMessage, setEngineMessage] = useState(null);

  // Set-once engine form state (populated from preferences defaults + DB)
  const [budgetWarningPct, setBudgetWarningPct] = useState(
    String(preferences.budget_warning_percent ?? 20)
  );
  const [billReminderDays, setBillReminderDays] = useState(
    String(preferences.bill_reminder_days ?? 3)
  );
  const [minimumBuffer, setMinimumBuffer] = useState(
    String(preferences.minimum_buffer ?? 0)
  );
  const [paydayDay, setPaydayDay] = useState(
    preferences.payday_day != null ? String(preferences.payday_day) : '25'
  );
  const [expectedIncome, setExpectedIncome] = useState(
    preferences.expected_monthly_income != null ? String(preferences.expected_monthly_income) : ''
  );
  const [cardSchedules, setCardSchedules] = useState(preferences.card_schedules || {});
  const [warningSwitches, setWarningSwitches] = useState({
    budget: true,
    pace: true,
    bills: true,
    goals: true,
    ...(preferences.warning_switches || {}),
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const creditCards = accounts.filter(isLiabilityAccount);

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
        setPreferences(loadedPrefs);

        setBudgetWarningPct(String(loadedPrefs.budget_warning_percent ?? 20));
        setBillReminderDays(String(loadedPrefs.bill_reminder_days ?? 3));
        setMinimumBuffer(String(loadedPrefs.minimum_buffer ?? 0));
        setPaydayDay(loadedPrefs.payday_day != null ? String(loadedPrefs.payday_day) : '');
        setExpectedIncome(
          loadedPrefs.expected_monthly_income != null ? String(loadedPrefs.expected_monthly_income) : ''
        );
        setCardSchedules(loadedPrefs.card_schedules || {});
        setWarningSwitches({
          budget: true,
          pace: true,
          bills: true,
          goals: true,
          ...(loadedPrefs.warning_switches || {}),
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const savePreferences = async (partial, targetMsgSetter = setPrefsMessage) => {
    targetMsgSetter(null);
    try {
      const payload = await apiClient.updatePreferences(partial);
      const saved = payload.data.preferences;
      if (saved.theme) setTheme(saved.theme);
      setPreferences(saved);
      targetMsgSetter({ kind: 'success', text: 'Settings saved to your account.' });
    } catch (err) {
      targetMsgSetter({
        kind: 'error',
        text: err.status ? err.message : 'Could not reach the ProMoney server. Settings not saved.',
      });
    }
  };

  const handleSaveEngineRules = async (event) => {
    event.preventDefault();
    const warnPct = Number(budgetWarningPct);
    const remindDays = Number(billReminderDays);
    const minBuf = Number(minimumBuffer || 0);
    const pDay = paydayDay.trim() === '' ? null : Number(paydayDay);
    const expInc = expectedIncome.trim() === '' ? null : Number(expectedIncome);

    if (!Number.isInteger(warnPct) || warnPct < 1 || warnPct > 100) {
      setEngineMessage({ kind: 'error', text: 'Budget warning threshold must be 1–100%.' });
      return;
    }
    if (!Number.isInteger(remindDays) || remindDays < 0 || remindDays > 30) {
      setEngineMessage({ kind: 'error', text: 'Bill reminder window must be 0–30 days.' });
      return;
    }
    if (!Number.isSafeInteger(minBuf) || minBuf < 0) {
      setEngineMessage({ kind: 'error', text: 'Minimum buffer must be ¥0 or a positive whole-yen amount.' });
      return;
    }
    if (pDay !== null && (!Number.isInteger(pDay) || pDay < 1 || pDay > 31)) {
      setEngineMessage({ kind: 'error', text: 'Payday must be a day of the month between 1 and 31.' });
      return;
    }
    if (expInc !== null && (!Number.isSafeInteger(expInc) || expInc < 0)) {
      setEngineMessage({ kind: 'error', text: 'Expected monthly income must be a non-negative whole-yen amount.' });
      return;
    }

    await savePreferences(
      {
        budget_warning_percent: warnPct,
        bill_reminder_days: remindDays,
        minimum_buffer: minBuf,
        payday_day: pDay,
        expected_monthly_income: expInc,
        card_schedules: cardSchedules,
        warning_switches: warningSwitches,
      },
      setEngineMessage
    );
  };

  const toggleWarningSwitch = (key) => {
    const nextSwitches = { ...warningSwitches, [key]: !warningSwitches[key] };
    setWarningSwitches(nextSwitches);
    savePreferences({ warning_switches: nextSwitches }, setEngineMessage);
  };

  const updateCardSchedule = (cardId, field, value) => {
    const num = Math.min(31, Math.max(1, Number(value) || 1));
    setCardSchedules((prev) => ({
      ...prev,
      [cardId]: {
        closing_day: prev[cardId]?.closing_day ?? 15,
        payment_day: prev[cardId]?.payment_day ?? 27,
        [field]: num,
      },
    }));
  };

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
    if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordMessage({
        kind: 'error',
        text: 'New password must be at least 10 characters and include a letter and a number.',
      });
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
        title="Settings"
        subtitle="Set-once Home engine rules, appearance, regional formats, and account security."
      />
      <NidhiMemorySettings />

      {loadError && (
        <section className="section-card card settings-card">
          <p className="settings-message error">{loadError}</p>
        </section>
      )}

      <CategoriesSettings />

      {/* Set-once Home & Engine Settings (Phase 5 Feature Spec) */}
      <section className="section-card card settings-card" aria-label="Home and engine set-once rules">
        <h2>Home &amp; Engine Set-Once Rules</h2>
        <p className="muted">
          Set these once — the ProMoney engine remembers them in the database and sharpens your Home safe-to-spend and warning strip automatically.
        </p>

        <form onSubmit={handleSaveEngineRules}>
          <div className="setting-row">
            <div>
              <strong>Budget Warning Threshold (%)</strong>
              <div className="muted small">Warn when a category&apos;s remaining budget falls to or below this % (default 20%).</div>
            </div>
            <input
              className="settings-input"
              type="number"
              min="1"
              max="100"
              step="1"
              value={budgetWarningPct}
              onChange={(e) => setBudgetWarningPct(e.target.value)}
              aria-label="Budget warning threshold percent"
            />
          </div>

          <div className="setting-row">
            <div>
              <strong>Bill Reminder Window (Days)</strong>
              <div className="muted small">Warn on Home when a bill is due within N days (default 3 days).</div>
            </div>
            <input
              className="settings-input"
              type="number"
              min="0"
              max="30"
              step="1"
              value={billReminderDays}
              onChange={(e) => setBillReminderDays(e.target.value)}
              aria-label="Bill reminder window days"
            />
          </div>

          <div className="setting-row">
            <div>
              <strong>Minimum Safety Buffer (JPY)</strong>
              <div className="muted small">Untouchable JPY kept out of safe-to-spend (default ¥0).</div>
            </div>
            <input
              className="settings-input"
              type="number"
              min="0"
              step="1000"
              value={minimumBuffer}
              onChange={(e) => setMinimumBuffer(e.target.value)}
              aria-label="Minimum buffer JPY"
            />
          </div>

          <div className="setting-row">
            <div>
              <strong>Payday (Day of Month)</strong>
              <div className="muted small">Day income usually arrives (1–31, e.g. 25th).</div>
            </div>
            <input
              className="settings-input"
              type="number"
              min="1"
              max="31"
              step="1"
              value={paydayDay}
              placeholder="e.g. 25"
              onChange={(e) => setPaydayDay(e.target.value)}
              aria-label="Payday day of month"
            />
          </div>

          <div className="setting-row">
            <div>
              <strong>Expected Monthly Income (JPY, Optional)</strong>
              <div className="muted small">If blank, the engine uses recorded income only and says so.</div>
            </div>
            <input
              className="settings-input"
              type="number"
              min="0"
              step="1000"
              value={expectedIncome}
              placeholder="Optional — e.g. 130000"
              onChange={(e) => setExpectedIncome(e.target.value)}
              aria-label="Expected monthly income JPY"
            />
          </div>

          {creditCards.length > 0 && (
            <div className="setting-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <strong>Credit Card Closing &amp; Payment Days</strong>
                <div className="muted small">Powers card-bill due warnings per card.</div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {creditCards.map((card) => {
                  const sched = cardSchedules[card.id] || { closing_day: 15, payment_day: 27 };
                  return (
                    <div key={card.id} className="settings-control" style={{ flexWrap: 'wrap' }}>
                      <span className="small" style={{ fontWeight: 600, minWidth: 110 }}>{card.name}:</span>
                      <label className="small">
                        Close day{' '}
                        <input
                          className="settings-input"
                          style={{ minWidth: 64, width: 64 }}
                          type="number"
                          min="1"
                          max="31"
                          value={sched.closing_day}
                          onChange={(e) => updateCardSchedule(card.id, 'closing_day', e.target.value)}
                        />
                      </label>
                      <label className="small">
                        Pay day{' '}
                        <input
                          className="settings-input"
                          style={{ minWidth: 64, width: 64 }}
                          type="number"
                          min="1"
                          max="31"
                          value={sched.payment_day}
                          onChange={(e) => updateCardSchedule(card.id, 'payment_day', e.target.value)}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="setting-row">
            <div>
              <strong>Home Warning Switches</strong>
              <div className="muted small">Choose which alerts appear on the Home warnings strip (all on by default).</div>
            </div>
            <div className="segmented" style={{ flexWrap: 'wrap' }}>
              {[
                ['budget', 'Budget %'],
                ['pace', 'Pace'],
                ['bills', 'Bills'],
                ['goals', 'Goals'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={warningSwitches[key] ? 'selected' : ''}
                  aria-pressed={Boolean(warningSwitches[key])}
                  onClick={() => toggleWarningSwitch(key)}
                >
                  {label}: {warningSwitches[key] ? 'On' : 'Off'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="submit" className="settings-button">
              Save Engine Rules
            </button>
          </div>
        </form>

        {engineMessage && (
          <p className={`settings-message ${engineMessage.kind}`} role="status">
            {engineMessage.text}
          </p>
        )}
      </section>

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

        {isDemo ? (
          <div className="setting-row">
            <span>Password &amp; Email</span>
            <span className="settings-readonly">
              Password and email changes are disabled for the shared Demo Account.
            </span>
          </div>
        ) : profile && !profile.has_password ? (
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
