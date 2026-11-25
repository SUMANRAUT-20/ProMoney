const stats = [
  [3, 'statement formats', 'CSV, XLSX, PDF'],
  [3, 'report formats', 'PDF, XLSX, CSV'],
  [2, 'confirmations before a Nidhi deletion'],
];

const benefits = [
  ['See what you have', 'Review cash, bank and credit accounts together. Card payments reduce what you owe.'],
  ['Know what’s due', 'Set spending limits and keep regular bills in view as you plan the month.'],
  ['Make progress visible', 'Set a savings goal and track what you’ve put toward it.'],
];

const useCases = [
  ['Daily spending', 'Record a purchase or review the rows from a statement. See where your money went by category.', 'See'],
  ['Bills and subscriptions', 'Keep regular payments together and check what’s coming up before you spend.', 'Balance'],
  ['Savings goals', 'Give a goal a name and target amount. Follow your progress as you set money aside.', 'Grow'],
];

const tagline = ['See your money', 'Balance your month', 'Grow what matters'];

const questions = [
  ['Who is ProMoney for?', 'ProMoney is a personal finance workspace for people who manage their money in Japanese yen.'],
  ['What’s in the demo?', 'The demo uses labeled sample data so you can explore before entering your own records.'],
  ['Can I import a statement?', 'Attach a CSV, XLSX or PDF statement in Nidhi and review the rows before choosing what to save. For an older XLS file, convert it to XLSX first.'],
  ['What can I plan with ProMoney?', 'Use Budgets for spending limits, Bills & Subscriptions for regular payments, and Savings Goals for what you want to set aside.'],
  ['What can Nidhi do?', 'Nidhi can explain your recorded figures and prepare changes for your review. Saving a proposed change requires your confirmation.'],
  ['Can I download a report?', 'Ask Nidhi for a report in PDF, XLSX or CSV and download it from the report card.'],
];

export function StatBand() {
  return (
    <section className="landing-stats" aria-label="ProMoney capabilities">
      <dl className="landing-shell" data-landing-reveal>
        {stats.map(([value, label, detail]) => (
          <div className="landing-stat" key={label}>
            <dt className="landing-stat-label">{label}</dt>
            <dd className="landing-stat-number">
              <span className="landing-visually-hidden">{value}</span>
              <span className="landing-counter" aria-hidden="true">
                <span style={{ '--landing-count': value }}>
                  {Array.from({ length: value + 1 }, (_, digit) => <span key={digit}>{digit}</span>)}
                </span>
              </span>
            </dd>
            {detail && <dd className="landing-stat-detail">{detail}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Statement() {
  return (
    <section className="landing-section landing-shell" aria-labelledby="landing-statement" data-landing-reveal>
      <h2 id="landing-statement" className="landing-statement-title">Give every yen a place.</h2>
      <div className="landing-benefits">
        {benefits.map(([title, description]) => (
          <div key={title}>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UseCases() {
  return (
    <section className="landing-use-cases" aria-labelledby="landing-use-cases">
      <div className="landing-section landing-shell" data-landing-reveal>
        <h2 id="landing-use-cases">Make a plan for your month.</h2>
        <div className="landing-use-cards">
          {useCases.map(([title, description, phase]) => (
            <article key={title}>
              <p className="landing-phase">{phase}</p>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Tagline() {
  return (
    <section className="landing-tagline" aria-labelledby="landing-tagline">
      <h2 id="landing-tagline" className="landing-shell" aria-label={tagline.join('. ')}>
        {tagline.map((line) => (
          <span key={line} className="landing-tagline-line" aria-hidden="true" data-landing-reveal>
            {line.split(' ').map((word, index) => (
              <span key={word} className="landing-word" style={{ '--landing-word-delay': (index * 90) + 'ms' }}>{word}</span>
            ))}
          </span>
        ))}
      </h2>
    </section>
  );
}

export function NidhiTeaser() {
  return (
    <section className="landing-nidhi landing-section landing-shell" aria-labelledby="landing-nidhi" data-landing-reveal>
      <div>
        <h2 id="landing-nidhi">Ask Nidhi. Review the next step.</h2>
        <p>Use plain language to start a savings goal. Nidhi puts the proposed details on a card for you to confirm.</p>
      </div>
      <figure className="landing-chat">
        <figcaption>Nidhi <span>Sample conversation</span></figcaption>
        <blockquote className="landing-chat-user">save 500000 for a Yamaha R1</blockquote>
        <p className="landing-chat-reply">Review the proposed change on the card before confirming.</p>
        <div className="landing-chat-proposal">
          <p>Create a savings goal</p>
          <dl>
            <div><dt>Goal</dt><dd>Yamaha R1</dd></div>
            <div><dt>Target</dt><dd>¥500,000</dd></div>
          </dl>
          <span className="landing-chat-confirm">Confirm</span>
        </div>
      </figure>
    </section>
  );
}

export function ProofStrip() {
  return (
    <section className="landing-proof" aria-label="How ProMoney handles your records">
      <ul className="landing-shell">
        <li>Demo data stays separate</li>
        <li>Review statement rows before adding</li>
        <li>Confirm proposed changes from Nidhi</li>
      </ul>
    </section>
  );
}

export function FAQ() {
  return (
    <section className="landing-faq landing-section landing-shell" aria-labelledby="landing-faq" data-landing-reveal>
      <h2 id="landing-faq">Good to know.</h2>
      <div>
        {questions.map(([title, description]) => (
          <details key={title}>
            <summary>{title}</summary>
            <p>{description}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
