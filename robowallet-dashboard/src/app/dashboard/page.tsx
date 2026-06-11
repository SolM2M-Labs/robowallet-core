"use client";

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { useEffect, useMemo, useState } from 'react';
import { ROBOWALLET_PROGRAM_ID, SOLANA_RPC_URL } from '../config';

// Next.js dynamic import for the Wallet button to avoid SSR hydration issues
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

interface AlertInfo {
  type: 'success' | 'error';
  message: string;
  signature?: string;
}

export default function Dashboard() {
  const { publicKey, sendTransaction } = useWallet();
  // One shared connection for the whole page — creating a new Connection per
  // request multiplies sockets and trips the public RPC's per-IP rate limit.
  const connection = useMemo(() => new Connection(SOLANA_RPC_URL, 'confirmed'), []);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [networkStatus, setNetworkStatus] = useState<string>("Connecting...");
  const [notification, setNotification] = useState<AlertInfo | null>(null);

  const [deviceInput, setDeviceInput] = useState<string>("5sxEFwxCv8E4c8Pa1nMxLYLp7czhXbHeWoo59ScJ5tJ8"); // default mock device
  const [pdaAddress, setPdaAddress] = useState<string>("");
  const [pdaBalance, setPdaBalance] = useState<number | null>(null);
  const [spendingLimitInput, setSpendingLimitInput] = useState<string>("0.05"); // default limit in SOL
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  // Compute PDA when publicKey or deviceInput changes
  useEffect(() => {
    if (!publicKey || !deviceInput) {
      setPdaAddress("");
      setPdaBalance(null);
      return;
    }
    try {
      const ownerPubkey = publicKey;
      const devicePubkey = new PublicKey(deviceInput.trim());
      const [pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("session"),
          ownerPubkey.toBuffer(),
          devicePubkey.toBuffer()
        ],
        new PublicKey(ROBOWALLET_PROGRAM_ID)
      );
      setPdaAddress(pda.toBase58());
    } catch (e) {
      setPdaAddress("Invalid Device Address");
      setPdaBalance(null);
    }
  }, [publicKey, deviceInput]);

  // Fetch block info, PDA balance, and recent program tx signatures
  useEffect(() => {
    const fetchSolanaData = async () => {
      try {
        const slot = await connection.getSlot();
        setCurrentSlot(slot);
        setNetworkStatus("Connected (Devnet)");

        // Fetch PDA Balance
        if (pdaAddress && pdaAddress !== "Invalid Device Address") {
          try {
            const bal = await connection.getBalance(new PublicKey(pdaAddress));
            setPdaBalance(bal / 1e9); // convert to SOL
          } catch (e) {
            setPdaBalance(0);
          }
        }

        // Fetch Program Tx Signatures
        try {
          const sigs = await connection.getSignaturesForAddress(
            new PublicKey(ROBOWALLET_PROGRAM_ID),
            { limit: 8 }
          );
          setRecentTransactions(sigs);
        } catch (txErr) {
          console.error("Error fetching transactions:", txErr);
        }

      } catch (e) {
        console.error(e);
        setNetworkStatus("Offline");
      }
    };

    fetchSolanaData();
    // 15s keeps us well under the public RPC's per-IP budget (was 5s → constant 429s)
    const interval = setInterval(fetchSolanaData, 15000);
    return () => clearInterval(interval);
  }, [pdaAddress, connection]);

  const handleInitializeSession = async () => {
    if (!publicKey || !deviceInput || !pdaAddress || pdaAddress === "Invalid Device Address") {
      setNotification({
        type: 'error',
        message: "Please connect wallet and provide a valid device address."
      });
      return;
    }
    setIsInitializing(true);
    setNotification(null); // clear previous
    try {
      const devicePubkey = new PublicKey(deviceInput.trim());
      const limitLamports = parseFloat(spendingLimitInput) * 1e9;

      // Layout instruction data:
      // - Discriminator: 8 bytes (45 82 5c ec 6b e7 9f 81)
      // - Device Pubkey: 32 bytes
      // - Spending Limit: u64 (8 bytes, little-endian)
      const discriminator = Buffer.from([0x45, 0x82, 0x5c, 0xec, 0x6b, 0xe7, 0x9f, 0x81]);
      const limitBuf = Buffer.alloc(8);
      let val = BigInt(limitLamports);
      for (let i = 0; i < 8; i++) {
        limitBuf[i] = Number(val & BigInt(0xff));
        val >>= BigInt(8);
      }
      const data = Buffer.concat([discriminator, devicePubkey.toBuffer(), limitBuf]);

      const keys = [
        { pubkey: new PublicKey(pdaAddress), isSigner: false, isWritable: true },
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ];

      const instruction = new TransactionInstruction({
        keys,
        programId: new PublicKey(ROBOWALLET_PROGRAM_ID),
        data
      });

      const tx = new Transaction().add(instruction);
      const signature = await sendTransaction(tx, connection);
      setNotification({
        type: 'success',
        message: "Session PDA Vault successfully initialized!",
        signature
      });
    } catch (e: any) {
      console.error(e);
      setNotification({
        type: 'error',
        message: `Transaction failed: ${e.message}`
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleRevokeSession = async () => {
    if (!publicKey || !deviceInput || !pdaAddress || pdaAddress === "Invalid Device Address") {
      setNotification({
        type: 'error',
        message: "Please connect wallet and provide a valid device address."
      });
      return;
    }
    setIsRevoking(true);
    setNotification(null); // clear previous
    try {
      // Discriminator: 8 bytes (44 72 b2 8c de 26 f8 d3)
      const data = Buffer.from([0x44, 0x72, 0xb2, 0x8c, 0xde, 0x26, 0xf8, 0xd3]);

      const keys = [
        { pubkey: new PublicKey(pdaAddress), isSigner: false, isWritable: true },
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ];

      const instruction = new TransactionInstruction({
        keys,
        programId: new PublicKey(ROBOWALLET_PROGRAM_ID),
        data
      });

      const tx = new Transaction().add(instruction);
      const signature = await sendTransaction(tx, connection);
      setNotification({
        type: 'success',
        message: "Session PDA Vault successfully revoked!",
        signature
      });
    } catch (e: any) {
      console.error(e);
      setNotification({
        type: 'error',
        message: `Revocation failed: ${e.message}`
      });
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <Link href="/" className="brand" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
          <img src="/logo.png" alt="RoboWallet Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid var(--accent-purple)' }} />
          <span>RoboWallet</span>
        </Link>
        <nav style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <a href="#" className="nav-link active">
            <span>📊</span> Fleet Dashboard
          </a>
          <a href="#" className="nav-link">
            <span>⚙️</span> Node Settings
          </a>
          <a href="#" className="nav-link">
            <span>🔑</span> Session Keys
          </a>
          <Link href="/docs" className="nav-link">
            <span>📖</span> API Docs
          </Link>
          <a href="https://x.com/RoboWallet_sdk" target="_blank" rel="noopener noreferrer" className="nav-link">
            <span>🐦</span> Twitter
          </a>
          <Link href="/" className="nav-link" style={{ marginTop: 'auto', borderTop: '1px dashed var(--border-dim)', paddingTop: '16px', color: 'var(--accent-yellow)', fontWeight: 'bold' }}>
            <span>🏠</span> Back to Home
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/" style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '8px 12px', borderRadius: '8px', color: 'var(--text-main)', textDecoration: 'none', border: '1px solid var(--border-dim)' }}>
              ← Home
            </Link>
            <div>
              <h1 className="page-title">Fleet Overview</h1>
              {publicKey && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  Identity: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                </p>
              )}
            </div>
          </div>
          {/* Replaced standard button with Solana Wallet Adapter Button */}
          <div style={{ filter: 'drop-shadow(0 0 10px rgba(153,69,255,0.2))' }}>
            <WalletMultiButton style={{ background: 'transparent', border: '1px solid var(--accent-purple)', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }} />
          </div>
        </header>

        {notification && (
          <div style={{
            background: notification.type === 'success' ? 'rgba(39, 201, 63, 0.1)' : 'rgba(255, 77, 77, 0.1)',
            border: notification.type === 'success' ? '1px solid var(--success-green)' : '1px solid #ff4d4d',
            color: notification.type === 'success' ? 'var(--success-green)' : '#ff4d4d',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: notification.type === 'success' ? '0 0 15px rgba(39, 201, 63, 0.15)' : '0 0 15px rgba(255, 77, 77, 0.15)',
            fontFamily: 'var(--font-sans)'
          }}>
            <div>
              <span style={{ fontWeight: 'bold', marginRight: '8px' }}>
                {notification.type === 'success' ? '🚀 Success:' : '❌ Error:'}
              </span>
              {notification.message}
              {notification.signature && (
                <span style={{ marginLeft: '8px' }}>
                  | Signature:{' '}
                  <a
                    href={`https://explorer.solana.com/tx/${notification.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-yellow)', textDecoration: 'none', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}
                  >
                    {notification.signature.slice(0, 8)}...{notification.signature.slice(-8)}
                  </a>
                </span>
              )}
            </div>
            <button
              onClick={() => setNotification(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '1.2rem',
                lineHeight: 1,
                padding: '0 4px'
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Top Metrics Grid */}
        <div className="grid-container">
          {/* Network Status Panel */}
          <div className="glass-panel" style={{ borderLeft: networkStatus.includes('Connected') ? '4px solid var(--success-green)' : '4px solid var(--accent-yellow)' }}>
            <div className="panel-header">
              <span>Network Status</span>
              <span className="badge" style={{ background: networkStatus.includes('Connected') ? 'rgba(39, 201, 63, 0.1)' : 'rgba(255, 189, 46, 0.1)', color: networkStatus.includes('Connected') ? 'var(--success-green)' : 'var(--accent-yellow)' }}>
                {networkStatus}
              </span>
            </div>
            <div className="panel-value highlight" style={{ fontSize: '1.5rem', wordBreak: 'break-all' }}>
              {currentSlot ? `Slot: ${currentSlot.toLocaleString()}` : "Syncing..."}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
              Contract: {ROBOWALLET_PROGRAM_ID.slice(0, 10)}...{ROBOWALLET_PROGRAM_ID.slice(-10)}
            </div>
          </div>

          {/* Session Key Vault Panel */}
          <div className="glass-panel" style={{ borderLeft: pdaBalance !== null ? '4px solid var(--accent-purple)' : '4px solid var(--border-dim)' }}>
            <div className="panel-header">
              <span>Session PDA Vault</span>
              <span className="badge" style={{ background: 'rgba(153, 69, 255, 0.1)', color: 'var(--accent-purple)' }}>
                Active
              </span>
            </div>
            <div className="panel-value highlight" style={{ fontSize: '1.1rem', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
              {pdaAddress ? `${pdaAddress.slice(0, 12)}...${pdaAddress.slice(-12)}` : "Connect Wallet"}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <div style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold' }}>
                Balance: {pdaBalance !== null ? `${pdaBalance.toFixed(4)} SOL` : "N/A"}
              </div>
              {pdaBalance !== null && pdaBalance > 0 && publicKey && (
                <button
                  onClick={handleRevokeSession}
                  disabled={isRevoking}
                  style={{
                    background: 'rgba(255, 77, 77, 0.1)',
                    border: '1px solid #ff4d4d',
                    color: '#ff4d4d',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {isRevoking ? "Revoking..." : "Revoke"}
                </button>
              )}
            </div>
          </div>

          {/* Session Initializer Panel */}
          <div className="glass-panel" style={{ border: '1px solid var(--accent-purple)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="panel-header" style={{ color: 'var(--text-main)' }}>
              <span>🔑 Initialize Session Vault</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input 
                type="text" 
                placeholder="Device Public Key (Base58)" 
                value={deviceInput}
                onChange={(e) => setDeviceInput(e.target.value)}
                style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  border: '1px solid var(--border-dim)', 
                  padding: '6px 10px', 
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)'
                }} 
              />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="Limit (SOL)" 
                  value={spendingLimitInput}
                  onChange={(e) => setSpendingLimitInput(e.target.value)}
                  style={{ 
                    flex: 1,
                    background: 'rgba(0,0,0,0.3)', 
                    border: '1px solid var(--border-dim)', 
                    padding: '6px 10px', 
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)'
                  }} 
                />
                <button 
                  onClick={handleInitializeSession}
                  disabled={isInitializing || !publicKey}
                  className="connect-btn" 
                  style={{ 
                    padding: '6px 12px', 
                    background: publicKey ? 'rgba(153, 69, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)', 
                    borderColor: publicKey ? 'var(--accent-purple)' : 'var(--border-dim)', 
                    color: publicKey ? 'var(--accent-purple)' : 'var(--text-muted)',
                    cursor: publicKey ? 'pointer' : 'not-allowed',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}
                >
                  {isInitializing ? "WAIT..." : "INITIALIZE"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Transaction Feed */}
        <div className="glass-panel" style={{ flex: 1, marginTop: '20px' }}>
          <div className="panel-header">
            <span>Live Node Activity (On-Chain Devnet)</span>
            <span className="badge" style={{ background: 'rgba(39, 201, 63, 0.1)', color: 'var(--success-green)', borderColor: 'rgba(39, 201, 63, 0.2)'}}>Live Syncing</span>
          </div>
          
          <ul className="feed-list" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx, idx) => (
                <li className="feed-item" key={idx} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-dim)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ marginRight: '12px' }}>⚡</span>
                    Signature: <a href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="tx-hash" style={{ color: 'var(--accent-yellow)', textDecoration: 'none' }}>
                      {tx.signature.slice(0, 12)}...{tx.signature.slice(-12)}
                    </a>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge" style={{ background: tx.err ? 'rgba(255,77,77,0.1)' : 'rgba(39,201,63,0.1)', color: tx.err ? '#ff4d4d' : 'var(--success-green)' }}>
                      {tx.err ? "Failed" : "Success"}
                    </span>
                    <span className="tx-amount" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Slot: {tx.slot}
                    </span>
                  </div>
                </li>
              ))
            ) : (
              <li className="feed-item" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                No transactions found for Program ID.
              </li>
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
