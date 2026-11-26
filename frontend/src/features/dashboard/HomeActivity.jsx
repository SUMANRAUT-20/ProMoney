import { ChartNoAxesColumn, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProgressBar } from '../../components/ui';
import { formatMonth, money } from '../../utils/formatters';

export function AccountRows({ accounts }) {
  if (accounts.length === 0) {
    return <span className="muted">No accounts added yet — add one on My Accounts.</span>;
  }

  return (
    <div className="recent-list">
      {accounts.map((account) => (
        <div className="recent-row" key={account.id}>
          <span className="home-account-icon" aria-hidden="true"><Wallet size={16} /></span>
          <div>
            <strong>{account.name}</strong>
            <small>{account.kind}</small>
          </div>
          <div className="recent-amount">
            <strong>{account.cardCredit ? `${money(account.cardCredit)} credit` : money(account.liveBalance)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AccountsCard({ accounts }) {
  return (
    <section className="section-card card home-accounts" aria-labelledby="home-accounts-title">
      <div className="section-title">
        <h2 id="home-accounts-title">Accounts</h2>
        <Link className="text-action" to="/my-accounts">View Accounts</Link>
      </div>
      <AccountRows accounts={accounts} />
    </section>
  );
}

export function SpendingActivity({ series }) {
  const chartMax = Math.max(0, ...series.map(({ expense }) => expense));

  return (
    <section className="section-card card home-activity" aria-labelledby="home-activity-title">
      <div className="section-title">
        <h2 id="home-activity-title">Spending Activity</h2>
        <span className="home-account-icon" aria-hidden="true"><ChartNoAxesColumn size={17} /></span>
      </div>
      <p className="muted small">Net expenses by recorded month</p>
      {series.length === 0 ? (
        <p className="home-activity-empty muted">Record transactions to see spending activity here.</p>
      ) : (
        <ul className="home-activity-chart">
          {series.map(({ month, expense }) => (
            <li key={month}>
              <div className="home-activity-label">
                <time dateTime={month}>{formatMonth(month)}</time>
                <strong>{money(expense)}</strong>
              </div>
              <div aria-hidden="true"><ProgressBar current={expense} target={chartMax} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
