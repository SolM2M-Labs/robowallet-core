"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';

// Next.js dynamic import for the Wallet button to avoid SSR hydration issues
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export default function Dashboard() {
  const { publicKey } = useWallet();

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="RoboWallet Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid var(--accent-purple)' }} />
          <span>RoboWallet</span>
        </div>
        <nav>
          <a href="#" className="nav-link active">
            <span>📊</span> Fleet Dashboard
          </a>
          <a href="#" className="nav-link">
            <span>⚙️</span> Node Settings
          </a>
          <a href="#" className="nav-link">
            <span>🔑</span> Session Keys
          </a>
          <a href="#" className="nav-link">
            <span>📖</span> API Docs
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-bar">
          <div>
            <h1 className="page-title">Fleet Overview</h1>
            {publicKey && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                Identity: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
              </p>
            )}
          </div>
          {/* Replaced standard button with Solana Wallet Adapter Button */}
          <div style={{ filter: 'drop-shadow(0 0 10px rgba(153,69,255,0.2))' }}>
            <WalletMultiButton style={{ background: 'transparent', border: '1px solid var(--accent-purple)', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }} />
          </div>
        </header>

        {/* Top Metrics Grid */}
        <div className="grid-container">
          {/* Active Nodes Panel */}
          <div className="glass-panel">
            <div className="panel-header">
              <span>Active Nodes</span>
              <span className="badge">Online</span>
            </div>
            <div className="panel-value highlight">1,248</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
              +12 this week
            </div>
          </div>

          {/* Transactions Panel */}
          <div className="glass-panel">
            <div className="panel-header">
              <span>Total Transactions (24h)</span>
              <span>⚡</span>
            </div>
            <div className="panel-value">45.2k</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
              ~0.005 SOL avg fee
            </div>
          </div>

          {/* Early Access Waitlist Panel */}
          <div className="glass-panel" style={{ border: '1px solid var(--accent-purple)' }}>
            <div className="panel-header" style={{ color: 'var(--text-main)' }}>
              <span>🚀 Join the Alpha Waitlist</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px', fontFamily: 'var(--font-sans)' }}>
              Get early access to the RoboWallet C/Rust SDK and Session Key smart contracts.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="email" 
                placeholder="developer@example.com" 
                style={{ 
                  flex: 1, 
                  background: 'rgba(0,0,0,0.3)', 
                  border: '1px solid var(--border-dim)', 
                  padding: '8px 12px', 
                  borderRadius: '6px',
                  color: 'white',
                  fontFamily: 'var(--font-mono)'
                }} 
              />
              <button className="connect-btn" style={{ padding: '8px 16px', background: 'rgba(153, 69, 255, 0.1)', borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)' }}>
                JOIN
              </button>
            </div>
          </div>
        </div>

        {/* Live Transaction Feed */}
        <div className="glass-panel" style={{ flex: 1 }}>
          <div className="panel-header">
            <span>Live Node Activity (OTQ Sync)</span>
            <span className="badge" style={{ background: 'rgba(250, 204, 21, 0.1)', color: 'var(--accent-yellow)', borderColor: 'rgba(250, 204, 21, 0.2)'}}>Polling...</span>
          </div>
          
          <ul className="feed-list">
            <li className="feed-item">
              <div>
                <span style={{ marginRight: '12px' }}>🔋</span>
                Node <span className="tx-hash">0xESP...4F2A</span> synced state.
              </div>
              <span className="tx-amount" style={{ color: 'var(--text-muted)' }}>2 sec ago</span>
            </li>
            <li className="feed-item">
              <div>
                <span style={{ marginRight: '12px' }}>💸</span>
                Node <span className="tx-hash">0xRPI...9B1C</span> processed payment.
              </div>
              <span className="tx-amount">+0.05 SOL</span>
            </li>
            <li className="feed-item">
              <div>
                <span style={{ marginRight: '12px' }}>📡</span>
                Node <span className="tx-hash">0xDRN...77X1</span> requested Blockhash.
              </div>
              <span className="tx-amount" style={{ color: 'var(--text-muted)' }}>14 sec ago</span>
            </li>
            <li className="feed-item">
              <div>
                <span style={{ marginRight: '12px' }}>💸</span>
                Node <span className="tx-hash">0xESP...2A22</span> processed payment.
              </div>
              <span className="tx-amount">+0.01 SOL</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
