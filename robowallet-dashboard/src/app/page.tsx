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
            A military-grade, zero-allocation embedded SDK that turns $5 microcontrollers into autonomous economic agents on the Solana blockchain.
          </p>
          
          <div className="hero-cta-group">
            <Link href="/dashboard" className="btn-primary">Initialize SDK</Link>
            <a href="https://github.com/SolM2M-Labs/robowallet-core" target="_blank" rel="noreferrer" className="btn-secondary">View Documentation</a>
          </div>
          
          <div className="tech-stack">
            <span>Backed By:</span>
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
              <p><span className="prompt">&gt;&gt;</span> generating ed25519 keypair... <span className="success">[OK]</span></p>
              <p><span className="prompt">&gt;&gt;</span> solana address: <span className="accent">4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R</span></p>
              <p><span className="prompt">&gt;&gt;</span> building transfer 5,000,000 lamports... <span className="success">[SIGNED]</span></p>
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
            <p>Native integration with ATECC608 secure elements. Private keys never touch the main application processor.</p>
          </div>
          <div className="feature-card">
            <div className="icon" style={{ fontSize: '36px', marginBottom: '24px' }}>🤖</div>
            <h3>DePIN Ready</h3>
            <p>Verify your IoT node, join the machine network, and start transacting autonomously on the fastest blockchain in the world.</p>
          </div>
        </div>
      </section>

    </div>
  );
}
