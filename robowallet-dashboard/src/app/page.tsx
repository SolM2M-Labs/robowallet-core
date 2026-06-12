import Link from 'next/link';
import './landing.css';

export default function LandingPage() {
  return (
    <div className="landing-wrapper">
      <div className="grid-overlay"></div>
      <div className="glow-orb solana-purple"></div>
      <div className="glow-orb caution-yellow"></div>
      <div className="hero-banner-bg"></div>

      <nav className="navbar">
        <div className="nav-logo">
          <img src="/logo.png" alt="Logo" className="logo-img" />
          <span className="logo-text">RoboWallet<span className="accent">.</span></span>
        </div>
        <div className="nav-links">
          <a href="#hardware">Hardware</a>
          <Link href="/playground">Playground</Link>
          <Link href="/docs">Docs</Link>
          <a href="https://x.com/RoboWallet_sdk" target="_blank" rel="noreferrer">Twitter</a>
          <a href="https://github.com/SolM2M-Labs/robowallet-core" target="_blank" rel="noreferrer">GitHub</a>
          <Link href="/dashboard" className="nav-btn">Launch App</Link>
        </div>
      </nav>

      <main className="hero-section">
        <div className="hero-content">
          <div className="badge">🔥 STRICTLY NO_STD RUST</div>
          <h1 className="hero-title" style={{ fontFamily: 'var(--font-display)', fontSize: '72px', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-2px', marginBottom: '24px', background: 'linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            The Machine<br/>Economy is Here.
          </h1>
          <p className="hero-subtitle">
            A zero-allocation embedded SDK that turns $5 microcontrollers into autonomous economic agents on Solana — with on-chain spending limits protecting every device.
          </p>
          
          <div className="hero-cta-group">
            <Link href="/playground" className="btn-primary">Try the Playground</Link>
            <Link href="/docs" className="btn-secondary">View Documentation</Link>
          </div>
          
          <div className="tech-stack">
            <span>Built With:</span>
            <div className="tech-logos">
              <span>Rust</span>
              <span className="separator">•</span>
              <span>ESP32</span>
              <span className="separator">•</span>
              <span>Solana</span>
              <span className="separator">•</span>
              <span>ATECC608</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="terminal-window">
            <div className="terminal-header">
              <span className="dot red" style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ff5f56', marginRight: '6px' }}></span>
              <span className="dot yellow" style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ffbd2e', marginRight: '6px' }}></span>
              <span className="dot green" style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#27c93f', marginRight: '16px' }}></span>
              <span className="terminal-title">robowallet@esp32: ~/core</span>
            </div>
            <div className="terminal-body" id="terminal-text">
              <p><span className="prompt">&gt;&gt;</span> boot sequence initiated...</p>
              <p><span className="prompt">&gt;&gt;</span> loading esp-hal (risc-v)... <span className="success">[OK]</span></p>
              <p><span className="prompt">&gt;&gt;</span> deriving ed25519 key from TRNG... <span className="success">[OK]</span></p>
              <p><span className="prompt">&gt;&gt;</span> fetching latest blockhash... <span className="success">[OK]</span></p>
              <p><span className="prompt">&gt;&gt;</span> signing transfer 5,000,000 lamports on-stack... <span className="success">[SIGNED]</span></p>
              <p><span className="prompt">&gt;&gt;</span> broadcast: <span className="accent">5jpmsfgeQtga…u51oxEjz</span> <span className="success">[FINALIZED]</span></p>
              <p className="blink-cursor">_</p>
            </div>
          </div>
        </div>
      </main>

      <section className="features-section" id="hardware">
        <h2 className="section-title" style={{ fontFamily: 'var(--font-display)', fontSize: '42px', textAlign: 'center', marginBottom: '70px', fontWeight: 700, letterSpacing: '-1px' }}>Built for Hardware.</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="icon" style={{ fontSize: '36px', marginBottom: '24px' }}>⚡</div>
            <h3>Zero Allocations</h3>
            <p>Pure `no_std` Rust. No heap memory, no crashes. Built specifically for resource-constrained devices like the ESP32-C3.</p>
          </div>
          <div className="feature-card">
            <div className="icon" style={{ fontSize: '36px', marginBottom: '24px' }}>🔒</div>
            <h3>Hardware Security</h3>
            <p>Keys derived on-device from the hardware TRNG and never leave the chip. On-chain session limits cap the damage even if a device is stolen.</p>
          </div>
          <div className="feature-card">
            <div className="icon" style={{ fontSize: '36px', marginBottom: '24px' }}>🤖</div>
            <h3>DePIN Ready</h3>
            <p>Verify your IoT node, join the machine network, and start transacting autonomously on the fastest blockchain in the world.</p>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border-dim)', padding: '40px 60px', marginTop: '100px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(9, 10, 15, 0.95)', zIndex: 10, position: 'relative' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          © 2026 RoboWallet Core. All rights reserved.
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <a href="https://x.com/RoboWallet_sdk" target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}>Twitter</a>
          <a href="https://github.com/SolM2M-Labs/robowallet-core" target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}>GitHub</a>
          <Link href="/docs" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}>Documentation</Link>
        </div>
      </footer>
    </div>
  );
}
