import { useFinance } from '../../context/FinanceContext';
import { PageHeading } from '../../components/ui';

/**
 * Settings & Preferences Foundation
 *
 * Keeps functional light/dark theme switching and displays Japan-local
 * currency/calendar conventions without demo data reset controls.
 */
export default function SettingsView() {
  const { theme, setTheme } = useFinance();

  return (
    <>
      <PageHeading
        title="Settings & Preferences"
        subtitle="Configure visual appearance and view regional workspace defaults."
      />

      <section className="section-card card settings-card">
        <h2>Appearance &amp; Theme</h2>
        <p className="muted">Switch between Ultra-Clean Finance light and dark modes.</p>

        <div className="setting-row">
          <span>Theme Mode</span>
          <div className="segmented">
            <button
              type="button"
              className={theme === 'light' ? 'selected' : ''}
              onClick={() => setTheme('light')}
            >
              Light
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'selected' : ''}
              onClick={() => setTheme('dark')}
            >
              Dark
            </button>
          </div>
        </div>

        <div className="setting-row">
          <span>Base Currency</span>
          <strong>Japanese Yen (JPY, ¥)</strong>
        </div>

        <div className="setting-row">
          <span>Calendar &amp; Date Format</span>
          <strong>Japan Standard Time (YYYY-MM-DD)</strong>
        </div>

        <div className="setting-row">
          <span>Account Profile &amp; Security Settings</span>
          <span className="muted">Feature not implemented yet (Phase 1 Auth)</span>
        </div>
      </section>
    </>
  );
}
