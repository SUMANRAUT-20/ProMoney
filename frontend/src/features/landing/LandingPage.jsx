import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { authFailure } from '../auth/authValidation';
import HomeDemo from './demo/HomeDemo';
import HeroSatellites from './HeroSatellites';
import LandingLogin from './LandingLogin';
import { FAQ, NidhiTeaser, ProofStrip, Statement, StatBand, Tagline, UseCases } from './LandingContent';
import './landing.css';
import './landingSections.css';

function DemoEntry({ onError }) {
  const started = useRef(false);
  const { loginDemo, isCheckingSession } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (started.current || isCheckingSession) return;
    started.current = true;
    loginDemo().then(() => navigate('/home', { replace: true })).catch(onError);
  }, [isCheckingSession, loginDemo, navigate, onError]);
  return null;
}

function Hero({ demo }) {
  return (
    <section className="landing-hero landing-shell" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <h1 id="landing-title">Know where your yen goes.</h1>
        <p>Track spending, plan for bills, and save toward what matters in one workspace for life in Japan.</p>
        {demo}
        <p className="landing-caption">Explore with sample data.</p>
      </div>
      <div className="landing-hero-scene">
        <HeroSatellites />
        <HomeDemo />
      </div>
    </section>
  );
}

function FinalCall({ demo }) {
  return (
    <section className="landing-final landing-shell" aria-labelledby="landing-final-title" data-landing-reveal>
      <div>
        <h2 id="landing-final-title">Take a look around.</h2>
        <p>See how a month of sample spending, bills, and savings fits together.</p>
        {demo}
      </div>
      <div className="landing-qr" aria-label="QR image placeholder">{'{{approved QR image}}'}</div>
    </section>
  );
}

export default function LandingPage({ sessionAvailable }) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [demo, setDemo] = useState(null);
  const page = useRef(null);
  const demoPending = Boolean(demo && !demo.error);

  const demoButton = (source) => (
    <>
      <button type="button" className="landing-demo-link" disabled={demoPending} onClick={() => setDemo({ source })}>
        {demoPending && demo.source === source ? 'Opening demo…' : 'Try the demo'} <span aria-hidden="true">↗</span>
      </button>
      {demo?.source === source && demo.error && <p role="status">{demo.error}</p>}
    </>
  );
  const authActions = (
    <>
      {loginOpen && <LandingLogin onClose={() => setLoginOpen(false)} />}
      {demoPending && <DemoEntry onError={(error) => setDemo({ ...demo, error: authFailure(error) })} />}
    </>
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'ProMoney · Personal finance in yen';
    return () => { document.title = previousTitle; };
  }, []);

  useLayoutEffect(() => {
    if (!window.IntersectionObserver || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        target.dataset.landingReveal = 'visible';
        observer.unobserve(target);
      }
    }, { threshold: 0.15 });
    page.current.querySelectorAll('[data-landing-reveal]').forEach((node) => {
      node.dataset.landingReveal = 'waiting';
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-root" ref={page}>
      <a className="landing-skip" href="#landing-content">Skip to content</a>
      <header className="landing-header landing-shell">
        <span className="landing-brand"><img src="/promoney-symbol.webp" width="32" height="32" alt="" /> ProMoney</span>
        <nav aria-label="Landing navigation">
          <button className="landing-login-link" type="button" disabled={demoPending} onClick={() => setLoginOpen(true)}>Log in <span aria-hidden="true">↗</span></button>
        </nav>
      </header>
      <main id="landing-content" tabIndex={-1}>
        <Hero demo={demoButton('hero')} />
        <StatBand />
        <Statement />
        <UseCases />
        <Tagline />
        <NidhiTeaser />
        <ProofStrip />
        <FAQ />
        <FinalCall demo={demoButton('final')} />
      </main>
      <footer className="landing-footer landing-shell">ProMoney</footer>
      {(loginOpen || demoPending) && (sessionAvailable ? authActions : <AuthProvider>{authActions}</AuthProvider>)}
    </div>
  );
}
