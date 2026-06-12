"use client";

import Link from 'next/link';
import { useState } from 'react';
import '../landing.css';

const codeBlockStyle: React.CSSProperties = {
  background: '#050608',
  border: '1px solid var(--border-dim)',
  padding: '16px',
  borderRadius: '4px',
  overflowX: 'auto',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  color: '#a0aec0',
  lineHeight: '1.5',
};

const bodyText: React.CSSProperties = {
  lineHeight: '1.7',
  color: 'var(--text-muted)',
  marginBottom: '16px',
};

const h4Style: React.CSSProperties = {
  color: 'var(--text-main)',
  margin: '20px 0 10px 0',
};

const PROGRAM_ID = 'ArgvLnQ5UhqJ9Ks7JF7nycbUJNzAgwR136LqzBNCCux9';

const TABS: { id: string; label: string; title: string; subtitle: string; content: React.ReactNode }[] = [
  {
    id: 'intro',
    label: '🚀 Getting Started',
    title: 'Introduction to RoboWallet Core',
    subtitle: 'Enabling the Solana Machine Economy on Microcontrollers',
    content: (
      <div>
        <p style={bodyText}>
          RoboWallet is a lightweight, zero-allocation, <code>no_std</code> embedded SDK and smart
          contract framework that lets IoT devices and microcontrollers act as autonomous economic
          agents on the Solana blockchain.
        </p>
        <div style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--accent-yellow)', padding: '16px', margin: '20px 0', borderRadius: '4px' }}>
          <h4 style={{ color: 'var(--text-main)', marginBottom: '6px' }}>Core Architectural Principles</h4>
          <ul style={{ listStyleType: 'disc', paddingLeft: '20px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <li><strong>Zero Heap Allocation:</strong> every transaction is built and signed in stack buffers — no fragmentation, no runtime allocator surprises.</li>
            <li><strong>On-Chain Spending Limits:</strong> the session-vault program enforces budgets at the protocol level, so a stolen device cannot overspend.</li>
            <li><strong>Verified Wire Format:</strong> the embedded builder&apos;s output is validated byte-for-byte against <code>@solana/web3.js</code> in CI scripts.</li>
          </ul>
        </div>
        <p style={bodyText}>
          Devnet program: <code style={{ color: 'var(--accent-yellow)' }}>{PROGRAM_ID}</code>
        </p>
      </div>
    ),
  },
  {
    id: 'quickstart',
    label: '⚡ Quickstart',
    title: 'Your First Machine Payment',
    subtitle: 'Zero to an on-chain, limit-enforced payment in ~10 minutes',
    content: (
      <div>
        <h4 style={h4Style}>1. Clone and install</h4>
        <pre style={codeBlockStyle}>
{`git clone https://github.com/SolM2M-Labs/robowallet-core
cd robowallet-core/scripts
npm install`}
        </pre>

        <h4 style={h4Style}>2. Get a devnet RPC</h4>
        <p style={bodyText}>
          Create a free key at helius.dev (or any provider) and copy the <em>devnet</em> RPC URL.
          The public <code>api.devnet.solana.com</code> works too, but rate-limits aggressively.
        </p>

        <h4 style={h4Style}>3. Run the full lifecycle — no hardware needed</h4>
        <pre style={codeBlockStyle}>
{`SOLANA_RPC_URL=<your-devnet-rpc> node verify_program.js`}
        </pre>
        <p style={bodyText}>
          The first run creates <code>scripts/test_owner.json</code> (your local owner wallet) and
          asks you to fund it with ~0.1 devnet SOL from faucet.solana.com. Run it again after
          funding and watch it: initialize a session vault → deposit → make a device-signed
          payment → attempt an over-limit payment (<strong>rejected on-chain</strong>) → close the
          vault and recover everything. Every signature it prints is a real devnet transaction you
          can open in the explorer.
        </p>

        <h4 style={h4Style}>4. Manage sessions from the dashboard</h4>
        <p style={bodyText}>
          Open the <Link href="/dashboard" style={{ color: 'var(--accent-yellow)' }}>dashboard</Link>,
          connect Phantom (set to devnet), paste your device&apos;s public key, choose a spending
          limit, hit <strong>Initialize</strong>, then <strong>Deposit</strong>. The activity feed
          decodes every program call live; <strong>Revoke</strong> returns rent and unspent funds
          any time.
        </p>

        <h4 style={h4Style}>5. Go hardware</h4>
        <pre style={codeBlockStyle}>
{`# bridge devices to the TLS-only RPC
SOLANA_RPC_URL=<your-devnet-rpc> node roborelay.js

# point the firmware at it (core/src/main.rs: SSID, GATEWAY_IP),
# then build for ESP32-C3
cd ../core && cargo build --release`}
        </pre>
        <p style={bodyText}>
          On boot the board derives its key from the hardware TRNG, prints its Solana address
          (fund it for fees), fetches a blockhash through the relay, signs on-chip and broadcasts.
        </p>
      </div>
    ),
  },
  {
    id: 'rust',
    label: '🦀 Rust Core SDK',
    title: 'Rust Core SDK (no_std)',
    subtitle: 'Real Solana transactions from stack buffers',
    content: (
      <div>
        <p style={bodyText}>
          The core library is strictly <code>no_std</code> and compiles for RISC-V (ESP32-C3) and
          other bare-metal targets — no allocator required by the SDK itself. It produces genuine
          Solana wire-format transactions — header, account keys, blockhash, compiled instructions
          and the Ed25519 signature — entirely on the stack.
        </p>
        <h4 style={h4Style}>Build and sign a transfer on-device</h4>
        <pre style={codeBlockStyle}>
{`use robowallet_core::crypto::RoboKeypair;
use robowallet_core::transaction::build_signed_transfer;

// Device identity: seed from the hardware TRNG or a secure element
let keypair = RoboKeypair::from_seed(&seed);

// Fully-signed transaction in a stack buffer — no heap
let mut tx = [0u8; 512];
let len = build_signed_transfer(
    &keypair.secret,
    &receiver,          // [u8; 32]
    5_000_000,          // lamports (0.005 SOL)
    &recent_blockhash,  // [u8; 32], from getLatestBlockhash
    &mut tx,
)?;

// tx[..len] is broadcast-ready: base64-encode and POST via sendTransaction`}
        </pre>
        <p style={bodyText}>
          For session-vault payments, <code>build_execute_payment</code> produces the
          spending-limit-protected program call with the same stack-only guarantees. Run{' '}
          <code>scripts/verify_core_tx.js</code> to confirm the output is byte-identical to a
          web3.js-built transaction.
        </p>
      </div>
    ),
  },
  {
    id: 'arduino',
    label: '🔌 C++ & Arduino FFI',
    title: 'C/C++ & Arduino IDE Integration',
    subtitle: 'Exposing the Rust core to C++ microcontrollers',
    content: (
      <div>
        <p style={bodyText}>
          The SDK compiles to a static library (<code>librobowallet_core.a</code>) with a C ABI,
          wrapped in an Arduino-friendly C++ class.
        </p>
        <h4 style={h4Style}>Library layout</h4>
        <pre style={codeBlockStyle}>
{`Arduino/libraries/RoboWallet/
├── library.properties
├── src/
│   ├── robowallet_ffi.h      <-- C FFI declarations
│   ├── robowallet.h          <-- C++ wrapper class
│   ├── RoboWallet.cpp
│   └── librobowallet_core.a  <-- Compiled Rust static library
└── examples/
    └── SendTransfer/`}
        </pre>
        <h4 style={h4Style}>Using the C++ class</h4>
        <pre style={codeBlockStyle}>
{`#include <RoboWallet.h>
RoboWallet wallet;

void setup() {
  // Device identity from the hardware TRNG
  uint8_t seed[32];
  for (int i = 0; i < 32; i += 4) {
    uint32_t r = esp_random();
    memcpy(seed + i, &r, 4);
  }
  wallet.setSeed(seed);
  Serial.println(wallet.getAddress());  // Base58 Solana address

  // Fully-signed, broadcast-ready transaction bytes
  uint8_t tx[256];
  int32_t len = wallet.buildSignedTransfer(
      receiver, 5000000ULL, blockhash, tx, sizeof(tx));
}`}
        </pre>
      </div>
    ),
  },
  {
    id: 'anchor',
    label: '🔑 Session Smart Contract',
    title: 'Solana Session Key Smart Contract',
    subtitle: 'On-chain spending limits for device keys',
    content: (
      <div>
        <p style={bodyText}>
          The owner wallet delegates a budget to a Program Derived Address — the <em>Session
          Vault</em> — bound to one device key. The program enforces the limit on every payment,
          so a stolen device can never spend beyond it.
        </p>
        <h4 style={h4Style}>PDA seed validation</h4>
        <pre style={codeBlockStyle}>
{`#[account(
    init,
    payer = owner,
    space = 8 + SessionState::INIT_SPACE,
    seeds = [b"session", owner.key().as_ref(), device_key.as_ref()],
    bump
)]
pub session_state: Account<'info, SessionState>,`}
        </pre>
        <h4 style={h4Style}>Limit enforcement in execute_payment</h4>
        <pre style={codeBlockStyle}>
{`let new_total = session_state
    .total_spent
    .checked_add(amount)
    .ok_or(ErrorCode::AmountOverflow)?;
require!(
    new_total <= session_state.spending_limit,
    ErrorCode::SpendingLimitExceeded
);

// PDAs carry data, so lamports move by direct debit/credit:
**session_info.try_borrow_mut_lamports()? -= amount;
**ctx.accounts.target.try_borrow_mut_lamports()? += amount;`}
        </pre>
        <p style={bodyText}>
          <code>close_session</code> lets the owner revoke at any time, recovering rent and any
          unspent balance.
        </p>
      </div>
    ),
  },
  {
    id: 'gateway',
    label: '📡 Device Gateway',
    title: 'RoboRelay Gateway',
    subtitle: 'Bridging device HTTP to TLS-only Solana RPC',
    content: (
      <div>
        <p style={bodyText}>
          Public Solana RPC endpoints require HTTPS, while bare-metal boards speak plain HTTP over
          TCP. RoboRelay is a tiny LAN gateway: run it on any machine near your fleet (laptop,
          Raspberry Pi, the robot&apos;s host computer) and point the firmware&apos;s{' '}
          <code>GATEWAY_IP</code> at it.
        </p>
        <pre style={codeBlockStyle}>
{`# forward devices to your devnet RPC
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=... \\
  node scripts/roborelay.js

# RoboRelay — device-to-Solana RPC gateway
# Listening: http://192.168.1.14:8899  <- set this as GATEWAY_IP`}
        </pre>
        <p style={bodyText}>
          The firmware then runs the full two-step flow on its own: fetch the latest blockhash,
          sign the transaction on-stack, and broadcast it — the gateway only forwards bytes and
          never sees a private key.
        </p>
      </div>
    ),
  },
  {
    id: 'simulator',
    label: '🖥️ Verification Suite',
    title: 'Simulators & On-Chain Verification',
    subtitle: 'Prove every layer without hardware',
    content: (
      <div>
        <p style={bodyText}>
          Every claim in this documentation is backed by a runnable script:
        </p>
        <pre style={codeBlockStyle}>
{`cd scripts && npm install

# Device simulator: builds and broadcasts a session payment
node mock_device.js

# Embedded builder vs web3.js: byte-for-byte comparison
node verify_core_tx.js

# Full on-chain lifecycle: initialize -> fund -> pay ->
# over-limit rejection -> close with rent recovery
SOLANA_RPC_URL=<devnet rpc> node verify_program.js`}
        </pre>
        <p style={bodyText}>
          The firmware pipeline itself (HTTP framing, blockhash parsing, on-stack signing) can be
          exercised end-to-end from a host machine with{' '}
          <code>txgen flow</code> against a running RoboRelay — the same code paths the ESP32
          executes.
        </p>
      </div>
    ),
  },
];

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<string>('intro');
  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="landing-wrapper" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="grid-overlay"></div>
      <div className="glow-orb solana-purple"></div>
      <div className="glow-orb caution-yellow"></div>
      <div className="hero-banner-bg" style={{ opacity: '0.1' }}></div>

      {/* Navbar */}
      <nav className="navbar">
        <Link href="/" className="nav-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src="/logo.png" alt="Logo" className="logo-img" />
          <span className="logo-text">RoboWallet<span className="accent">.</span></span>
        </Link>
        <div className="nav-links">
          <Link href="/">Home</Link>
          <a href="https://x.com/RoboWallet_sdk" target="_blank" rel="noreferrer">Twitter</a>
          <a href="https://github.com/SolM2M-Labs/robowallet-core" target="_blank" rel="noreferrer">GitHub</a>
          <Link href="/dashboard" className="nav-btn">Launch App</Link>
        </div>
      </nav>

      {/* Main Docs Section */}
      <div style={{ display: 'flex', flex: 1, zIndex: 10, padding: '40px 60px', gap: '40px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>

        {/* Sidebar */}
        <aside style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-main)', letterSpacing: '1px', textTransform: 'uppercase' }}>Documentation</h3>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? 'rgba(250, 204, 21, 0.1)' : 'transparent',
                border: '1px solid',
                borderColor: activeTab === tab.id ? 'var(--accent-yellow)' : 'transparent',
                color: activeTab === tab.id ? 'var(--accent-yellow)' : 'var(--text-muted)',
                textAlign: 'left',
                padding: '12px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </aside>

        {/* Content Panel */}
        <main className="glass-panel" style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', minHeight: '500px', background: 'rgba(9, 10, 15, 0.75)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', letterSpacing: '-0.5px' }}>
            {active.title}
          </h1>
          <p style={{ color: 'var(--accent-yellow)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '30px' }}>
            {active.subtitle}
          </p>
          <div style={{ flex: 1 }}>{active.content}</div>
        </main>
      </div>

      {/* Footer */}
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
