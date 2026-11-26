import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../../context/FinanceContext';
import { PageHeading } from '../../components/ui';
import { currentMonthISO, formatMonth, todayISO } from '../../utils/formatters';
import { buildHomeSummary, getMonthlySavingsSeries } from '../../utils/financeMath';
import { AccountsCard, SpendingActivity } from './HomeActivity';
import { MoneyCard, SafeToSpendCard } from './HomeBalances';
import { NeedsAttention, NidhiAlert, RecentTransactions, SavingsGoals } from './HomeSections';
import './home.css';

export default function DashboardView() {
  const navigate = useNavigate();
  const { accounts, transactions, budgets, bills, goals, categories, preferences } = useFinance();
  const today = todayISO();
  const month = currentMonthISO();
  const home = buildHomeSummary({
    accounts,
    transactions,
    budgets,
    bills,
    goals,
    categories,
    preferences,
    today,
    month,
  });

  return (
    <div className="home-stack">
      <PageHeading
        title="Home"
        subtitle={`Your daily JPY snapshot for ${formatMonth(month)} — tap any headline card to see its breakdown.`}
        action={
          <button className="btn primary" type="button" onClick={() => navigate('/transactions')}>
            <Plus size={16} /> Record Transaction
          </button>
        }
      />
      <div className="home-grid">
        <MoneyCard balance={home.moneyYouHold} />
        <SafeToSpendCard safe={home.safeToSpend} />
        <NeedsAttention bills={home.billsToPay} warnings={home.warnings} preferences={preferences} />
        <SavingsGoals goals={home.goalRings} />
        <RecentTransactions transactions={home.recentTransactions} />
        <AccountsCard accounts={home.moneyYouHold.accountBreakdown} />
        <SpendingActivity series={getMonthlySavingsSeries(transactions).slice(-6)} />
        <NidhiAlert alertText={home.laboAlertText} />
      </div>
    </div>
  );
}
