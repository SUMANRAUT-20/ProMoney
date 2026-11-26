import { useState } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { money } from '../../utils/formatters';
import { AccountRows } from './HomeActivity';

export function MoneyCard({ balance }) {
  const [showMoneyProof, setShowMoneyProof] = useState(false);

  return (
    <section
      className="section-card card home-tap-card home-money"
      aria-label="Money you hold"
      onClick={() => setShowMoneyProof((v) => !v)}
    >
      <div className="home-card-head">
        <span className="eyebrow">
          <Wallet size={15} color="var(--green)" /> MONEY YOU HOLD (SPENDABLE)
        </span>
        <button
          type="button"
          className="icon-button"
          aria-expanded={showMoneyProof}
          aria-label="Toggle Money you hold breakdown"
          onClick={(e) => {
            e.stopPropagation();
            setShowMoneyProof((v) => !v);
          }}
        >
          {showMoneyProof ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <div className="home-big-amount">{money(balance.spendable)}</div>

      <div className="home-sublines">
        <span>
          Your real money: <strong>{money(balance.realMoney)}</strong>
        </span>
        <span>
          To pay back: <strong>{money(balance.toPayBack)}</strong>
        </span>
      </div>

      {showMoneyProof && (
        <div className="home-proof-panel" onClick={(e) => e.stopPropagation()}>
          <strong>Engine Breakdown (Cash + Bank + Digital)</strong>
          <AccountRows accounts={balance.accountBreakdown} />
        </div>
      )}
    </section>
  );
}

export function SafeToSpendCard({ safe }) {
  const [showSafeProof, setShowSafeProof] = useState(false);

  return (
    <section
      className="section-card card home-tap-card home-safe"
      aria-label="Safe to spend today"
      onClick={() => setShowSafeProof((v) => !v)}
    >
      <div className="home-card-head">
        <span className="eyebrow">
          <CalendarClock size={15} color="var(--green)" /> SAFE TO SPEND TODAY
        </span>
        <button
          type="button"
          className="icon-button"
          aria-expanded={showSafeProof}
          aria-label="Toggle Safe to spend formula breakdown"
          onClick={(e) => {
            e.stopPropagation();
            setShowSafeProof((v) => !v);
          }}
        >
          {showSafeProof ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <div className="home-big-amount" style={{ color: safe.overPlan ? 'var(--red)' : 'var(--text)' }}>
        {money(safe.dailySafe)} <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>/ day</span>
      </div>

      <div className="home-sublines">
        <span>
          Safe this month: <strong>{money(safe.availablePool)}</strong>
        </span>
        <span>
          Days left: <strong>{safe.daysLeft}d</strong>
        </span>
      </div>

      {showSafeProof && (
        <div className="home-proof-panel" onClick={(e) => e.stopPropagation()}>
          <strong>Formula: (Money + Expected Income − Bills − Goal Plan − Buffer) ÷ Days Left</strong>
          <div className="home-proof-row">
            <span>Spendable balance</span>
            <strong>{money(safe.spendable)}</strong>
          </div>
          <div className="home-proof-row">
            <span>+ Income still expected</span>
            <strong>{money(safe.incomeStillExpected)}</strong>
          </div>
          <div className="home-proof-row">
            <span>− Bills still due this month</span>
            <strong>{money(safe.billsStillDue)}</strong>
          </div>
          <div className="home-proof-row">
            <span>− Goal saving plan</span>
            <strong>{money(safe.goalSavingPlan)}</strong>
          </div>
          <div className="home-proof-row">
            <span>− Minimum buffer</span>
            <strong>{money(safe.buffer)}</strong>
          </div>
          <div className="home-proof-row">
            <span>÷ {safe.daysLeft} days left in month</span>
            <strong>{money(safe.dailySafe)} / day</strong>
          </div>
        </div>
      )}
    </section>
  );
}
