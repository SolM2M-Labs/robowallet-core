"use client";

import Link from 'next/link';
import { useState } from 'react';
import '../landing.css';

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<string>("intro");

  const sections = {
    intro: {
      title: "Introduction to RoboWallet Core",
      subtitle: "Enabling the Solana Machine Economy on Microcontrollers",
      content: (
        <div>
          <p style={{ lineHeight: '1.7', color: 'var(--text-muted)', marginBottom: '16px' }}>
            RoboWallet is a lightweight, zero-allocation, <code>no_std</code> embedded SDK and smart contract framework designed to let physical IoT devices and microcontrollers act as autonomous economic agents on the Solana blockchain.
          </p>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--accent-yellow)', padding: '16px', margin: '20px 0', borderRadius: '4px' }}>
            <h4 style={{ color: 'var(--text-main)', marginBottom: '6px' }}>Core Architectural Principles</h4>
            <ul style={{ listStyleType: 'disc', paddingLeft: '20px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <li><strong>Zero Heap Memory Allocation:</strong> Avoids fragmentation and runtime crashes on embedded hardware.</li>
              <li><strong>Hardware-Offloaded Security:</strong> Built-in FFI support for secure elements like the ATECC608A.</li>
              <li><strong>Session Key PDA Delegation:</strong> Restricts financial blast radius using on-chain smart contracts.</li>
            </ul>
          </div>
        </div>
      )
    },
    rust: {
      title: "Rust Core SDK (no_std)",
      subtitle: "Low-level system serialization & cryptography",
      content: (
        <div>
          <p style={{ lineHeight: '1.7', color: 'var(--text-muted)', marginBottom: '16px' }}>
            The core library is written in strictly <code>no_std</code> Rust to compile to under 150KB of flash, making it compatible with ESP32 Xtensa and RISC-V architectures.
          </p>
          <h4 style={{ color: 'var(--text-main)', margin: '20px 0 10px 0' }}>Example: Construction of transaction message in Rust</h4>
          <pre style={{ background: '#050608', border: '1px solid var(--border-dim)', padding: '16px', borderRadius: '4px', overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#a0aec0', lineHeight: '1.5' }}>
{`// Bounded stack vector for Solana Transaction
pub struct TransactionBuffer<'a> {
    pub num_signatures: u8,
    pub signatures: &'a mut [u8], 
    pub recent_blockhash: [u8; 32],
    pub instructions: heapless::Vec<CompiledInstruction, 4>,
}

impl<'a> TransactionBuffer<'a> {
    pub fn new(receiver: [u8; 32], lamports: u64, hash: [u8; 32]) -> Self {
        // Zero-allocation initialization
    }
}`}
          </pre>
        </div>
      )
    },
    arduino: {
      title: "C/C++ & Arduino IDE Integration",
      subtitle: "Exposing Rust Core to C++ microcontrollers",
      content: (
        <div>
          <p style={{ lineHeight: '1.7', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Using Rust's Foreign Function Interface (FFI), the SDK compiles to a standard static library (<code>librobowallet_core.a</code>) that can be imported directly into C++ and Arduino IDE projects.
          </p>
          <h4 style={{ color: 'var(--text-main)', margin: '20px 0 10px 0' }}>Directory structure of the Arduino Library</h4>
          <pre style={{ background: '#050608', border: '1px solid var(--border-dim)', padding: '16px', borderRadius: '4px', overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#a0aec0', lineHeight: '1.5' }}>
{`Arduino/libraries/RoboWallet/
├── library.properties
├── src/
│   ├── robowallet.h          <-- Raw C FFI declarations
│   ├── RoboWallet.h          <-- C++ Wrapper Class header
│   ├── RoboWallet.cpp        <-- C++ Class implementation
│   └── librobowallet_core.a  <-- Compiled Rust static binary
└── examples/
    └── SendTransfer/`}
          </pre>
          <h4 style={{ color: 'var(--text-main)', margin: '20px 0 10px 0' }}>Using the C++ class in Arduino</h4>
          <pre style={{ background: '#050608', border: '1px solid var(--border-dim)', padding: '16px', borderRadius: '4px', overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#a0aec0', lineHeight: '1.5' }}>
{`#include <RoboWallet.h>
RoboWallet wallet;

void setup() {
  String address = wallet.generateTestWallet();
  Serial.println("Public Key: " + address);
  
  uint8_t receiver[32] = {0}; 
  uint8_t blockhash[32] = {9};
  wallet.buildAndSignTransfer(receiver, 5000000, blockhash);
}`}
          </pre>
        </div>
      )
    },
    anchor: {
      title: "Solana Session Key Smart Contract",
      subtitle: "Anchor on-chain transaction spending limits",
      content: (
        <div>
          <p style={{ lineHeight: '1.7', color: 'var(--text-muted)', marginBottom: '16px' }}>
            To safeguard hardware devices from being stolen, the owner wallet delegates a specific amount of funds to a Program Derived Address (PDA) called a Session Vault.
          </p>
          <h4 style={{ color: 'var(--text-main)', margin: '20px 0 10px 0' }}>Anchor PDA Seed Validation</h4>
          <pre style={{ background: '#050608', border: '1px solid var(--border-dim)', padding: '16px', borderRadius: '4px', overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#a0aec0', lineHeight: '1.5' }}>
{`#[derive(Accounts)]
#[instruction(device_key: Pubkey)]
pub struct InitializeSession<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + SessionState::INIT_SPACE,
        seeds = [b"session", owner.key().as_ref(), device_key.as_ref()],
        bump
    )]
    pub session_state: Account<'info, SessionState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}`}
          </pre>
        </div>
      )
    },
    simulator: {
      title: "M2M Device Simulator",
      subtitle: "Testing transaction broadcasting",
      content: (
        <div>
          <p style={{ lineHeight: '1.7', color: 'var(--text-muted)', marginBottom: '16px' }}>
            We provide a Node.js-based device simulator to test the exact binary serialization and keypair signatures without needing physical ESP32 hardware connected.
          </p>
          <h4 style={{ color: 'var(--text-main)', margin: '20px 0 10px 0' }}>How to run the simulator</h4>
          <pre style={{ background: '#050608', border: '1px solid var(--border-dim)', padding: '16px', borderRadius: '4px', overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#a0aec0', lineHeight: '1.5' }}>
{`# Navigate to scripts directory
cd scripts

# Install dependencies (@solana/web3.js and bs58)
npm install

# Run the simulator
node mock_device.js`}
          </pre>
        </div>
      )
    }
  };

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
          <button 
            onClick={() => setActiveTab("intro")}
            style={{ 
              background: activeTab === "intro" ? 'rgba(250, 204, 21, 0.1)' : 'transparent',
              border: '1px solid',
              borderColor: activeTab === "intro" ? 'var(--accent-yellow)' : 'transparent',
              color: activeTab === "intro" ? 'var(--accent-yellow)' : 'var(--text-muted)',
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            🚀 Getting Started
          </button>
          <button 
            onClick={() => setActiveTab("rust")}
            style={{ 
              background: activeTab === "rust" ? 'rgba(250, 204, 21, 0.1)' : 'transparent',
              border: '1px solid',
              borderColor: activeTab === "rust" ? 'var(--accent-yellow)' : 'transparent',
              color: activeTab === "rust" ? 'var(--accent-yellow)' : 'var(--text-muted)',
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            🦀 Rust Core SDK
          </button>
          <button 
            onClick={() => setActiveTab("arduino")}
            style={{ 
              background: activeTab === "arduino" ? 'rgba(250, 204, 21, 0.1)' : 'transparent',
              border: '1px solid',
              borderColor: activeTab === "arduino" ? 'var(--accent-yellow)' : 'transparent',
              color: activeTab === "arduino" ? 'var(--accent-yellow)' : 'var(--text-muted)',
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            🔌 C++ & Arduino FFI
          </button>
          <button 
            onClick={() => setActiveTab("anchor")}
            style={{ 
              background: activeTab === "anchor" ? 'rgba(250, 204, 21, 0.1)' : 'transparent',
              border: '1px solid',
              borderColor: activeTab === "anchor" ? 'var(--accent-yellow)' : 'transparent',
              color: activeTab === "anchor" ? 'var(--accent-yellow)' : 'var(--text-muted)',
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            🔑 Session Smart Contract
          </button>
          <button 
            onClick={() => setActiveTab("simulator")}
            style={{ 
              background: activeTab === "simulator" ? 'rgba(250, 204, 21, 0.1)' : 'transparent',
              border: '1px solid',
              borderColor: activeTab === "simulator" ? 'var(--accent-yellow)' : 'transparent',
              color: activeTab === "simulator" ? 'var(--accent-yellow)' : 'var(--text-muted)',
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            🖥️ M2M Device Simulator
          </button>
        </aside>

        {/* Content Panel */}
        <main className="glass-panel" style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', minHeight: '500px', background: 'rgba(9, 10, 15, 0.75)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', letterSpacing: '-0.5px' }}>
            {sections[activeTab as keyof typeof sections].title}
          </h1>
          <p style={{ color: 'var(--accent-yellow)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '30px' }}>
            {sections[activeTab as keyof typeof sections].subtitle}
          </p>
          <div style={{ flex: 1 }}>
            {sections[activeTab as keyof typeof sections].content}
          </div>
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
