import './heroSatellites.css';

function Satellite({ type, title, children }) {
  return (
    <div className="landing-satellite" data-type={type}>
      <div className="landing-satellite-label"><strong>{title}</strong><span>Sample data</span></div>
      {children}
    </div>
  );
}

export default function HeroSatellites() {
  return (
    <aside className="landing-satellites" aria-label="Sample ProMoney cards">
      <Satellite type="bill" title="Bills to Pay">
        <strong className="landing-satellite-amount">¥5,280</strong>
        <p>Internet · Due in 2d</p>
      </Satellite>
      <Satellite type="goal" title="Savings Goals">
        <div className="landing-satellite-goal">
          <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
            <circle cx="20" cy="20" r="16" />
            <circle cx="20" cy="20" r="16" pathLength="100" strokeDasharray="17 83" />
          </svg>
          <div><strong>Yamaha R1</strong><p>¥430,000 / ¥2,530,000</p></div>
        </div>
      </Satellite>
      <Satellite type="safe" title="Safe to Spend">
        <strong className="landing-satellite-amount">¥4,750 <small>/ day</small></strong>
      </Satellite>
      <Satellite type="categories" title="Spending by category">
        <div className="landing-satellite-bar"><span>Food &amp; Dining</span><strong>¥1,200</strong></div>
        <div className="landing-satellite-bar"><span>Transport</span><strong>¥800</strong></div>
      </Satellite>
    </aside>
  );
}
