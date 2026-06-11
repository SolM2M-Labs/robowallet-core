"use client";

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ROBOWALLET_PROGRAM_ID, SOLANA_RPC_URL } from '../config';

// Next.js dynamic import for the Wallet button to avoid SSR hydration issues
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

// ---------- On-chain constants ----------

const PROGRAM_KEY = new PublicKey(ROBOWALLET_PROGRAM_ID);

const DISC = {
  initialize: '45825cec6be79f81',
  execute: '56040707788be88b',
  close: '4472b28cde26f8d3',
} as const;

// ---------- Decoding helpers (no extra deps) ----------

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58decode(s: string): Uint8Array {
  const bytes: number[] = [];
  for (const c of s) {
    let v = B58_ALPHABET.indexOf(c);
    if (v < 0) return new Uint8Array();
    for (let i = 0; i < bytes.length; i++) {
      v += bytes[i] * 58;
      bytes[i] = v & 0xff;
      v >>= 8;
    }
    while (v > 0) {
      bytes.push(v & 0xff);
      v >>= 8;
    }
  }
  for (const c of s) {
    if (c === '1') bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readU64LE(bytes: Uint8Array, offset: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
  return Number(view.getBigUint64(0, true));
}

function timeAgo(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return '—';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortAddr(addr: string, n = 4): string {
  return `${addr.slice(0, n)}…${addr.slice(-n)}`;
}

// ---------- Types ----------

interface SessionState {
  owner: string;
  deviceKey: string;
  spendingLimit: number; // lamports
  totalSpent: number;    // lamports
}

interface ActivityEntry {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: boolean;
  kind: 'initialize' | 'payment' | 'close' | 'deploy' | 'other';
  amount: number | null; // lamports (payment amount or init limit)
}

interface AlertInfo {
  type: 'success' | 'error';
  message: string;
  signature?: string;
}

const KIND_META: Record<ActivityEntry['kind'], { icon: string; label: string; className: string }> = {
  initialize: { icon: '🔑', label: 'Session Initialized', className: 'kind-init' },
  payment: { icon: '⚡', label: 'M2M Payment', className: 'kind-payment' },
  close: { icon: '🔒', label: 'Session Closed', className: 'kind-close' },
  deploy: { icon: '🛠️', label: 'Program Deploy', className: 'kind-other' },
  other: { icon: '📡', label: 'Program Activity', className: 'kind-other' },
};

// ---------- Page ----------

export default function Dashboard() {
  const { publicKey, sendTransaction } = useWallet();
  // One shared connection for the whole page — creating a new Connection per
  // request multiplies sockets and trips the public RPC's per-IP rate limit.
  const connection = useMemo(() => new Connection(SOLANA_RPC_URL, 'confirmed'), []);

  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [networkStatus, setNetworkStatus] = useState<string>('Connecting…');
  const [notification, setNotification] = useState<AlertInfo | null>(null);

  const [deviceInput, setDeviceInput] = useState<string>('5sxEFwxCv8E4c8Pa1nMxLYLp7czhXbHeWoo59ScJ5tJ8');
  const [pdaAddress, setPdaAddress] = useState<string>('');
  const [pdaBalance, setPdaBalance] = useState<number | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [spendingLimitInput, setSpendingLimitInput] = useState<string>('0.05');
  const [depositInput, setDepositInput] = useState<string>('0.05');
  const [busy, setBusy] = useState<string | null>(null); // 'init' | 'revoke' | 'deposit'
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);

  // ----- PDA derivation -----
  useEffect(() => {
    if (!publicKey || !deviceInput) {
      setPdaAddress('');
      setPdaBalance(null);
      setSession(null);
      return;
    }
    try {
      const devicePubkey = new PublicKey(deviceInput.trim());
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('session'), publicKey.toBuffer(), devicePubkey.toBuffer()],
        PROGRAM_KEY
      );
      setPdaAddress(pda.toBase58());
    } catch {
      setPdaAddress('invalid');
      setPdaBalance(null);
      setSession(null);
    }
  }, [publicKey, deviceInput]);

  // ----- Polling: slot, vault state, decoded activity -----
  const refresh = useCallback(async () => {
    try {
      const slot = await connection.getSlot();
      setCurrentSlot(slot);
      setNetworkStatus('Connected (Devnet)');

      // Vault: balance + decoded SessionState account
      if (pdaAddress && pdaAddress !== 'invalid') {
        try {
          const info = await connection.getAccountInfo(new PublicKey(pdaAddress));
          if (info) {
            setPdaBalance(info.lamports / LAMPORTS_PER_SOL);
            const data = new Uint8Array(info.data);
            // SessionState: disc(8) + owner(32) + device(32) + limit(8) + spent(8) + bump(1)
            if (data.length >= 89) {
              setSession({
                owner: new PublicKey(data.slice(8, 40)).toBase58(),
                deviceKey: new PublicKey(data.slice(40, 72)).toBase58(),
                spendingLimit: readU64LE(data, 72),
                totalSpent: readU64LE(data, 80),
              });
            }
          } else {
            setPdaBalance(null);
            setSession(null);
          }
        } catch {
          setPdaBalance(null);
          setSession(null);
        }
      }

      // Decoded program activity
      try {
        const sigs = await connection.getSignaturesForAddress(PROGRAM_KEY, { limit: 10 });
        const txs = await connection.getParsedTransactions(
          sigs.map((s) => s.signature),
          { maxSupportedTransactionVersion: 0 }
        );
        // Key decoded info by each tx's own signature — array order from the
        // RPC is not guaranteed to match the requested signature order.
        const decodedBySig = new Map<string, { kind: ActivityEntry['kind']; amount: number | null }>();
        for (const tx of txs) {
          if (!tx) continue;
          let kind: ActivityEntry['kind'] = 'other';
          let amount: number | null = null;
          for (const ix of tx.transaction.message.instructions) {
            const pid = 'programId' in ix ? ix.programId.toBase58() : '';
            if (pid === ROBOWALLET_PROGRAM_ID && 'data' in ix) {
              const raw = b58decode(ix.data);
              const disc = toHex(raw.slice(0, 8));
              if (disc === DISC.execute) {
                kind = 'payment';
                if (raw.length >= 16) amount = readU64LE(raw, 8);
              } else if (disc === DISC.initialize) {
                kind = 'initialize';
                if (raw.length >= 48) amount = readU64LE(raw, 40);
              } else if (disc === DISC.close) {
                kind = 'close';
              }
            } else if (pid === 'BPFLoaderUpgradeab1e11111111111111111111111' && kind === 'other') {
              kind = 'deploy';
            }
          }
          decodedBySig.set(tx.transaction.signatures[0], { kind, amount });
        }
        const entries: ActivityEntry[] = sigs.map((s) => {
          const decoded = decodedBySig.get(s.signature) ?? { kind: 'other' as const, amount: null };
          return {
            signature: s.signature,
            slot: s.slot,
            blockTime: s.blockTime ?? null,
            err: !!s.err,
            kind: decoded.kind,
            amount: decoded.amount,
          };
        });
        setActivity(entries);
        setActivityLoaded(true);
      } catch (e) {
        console.error('activity fetch failed', e);
      }
    } catch (e) {
      console.error(e);
      setNetworkStatus('Offline');
    }
  }, [connection, pdaAddress]);

  useEffect(() => {
    refresh();
    // 15s keeps us well under RPC per-IP budgets
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  // ----- Actions -----

  const guard = (): boolean => {
    if (!publicKey || !pdaAddress || pdaAddress === 'invalid') {
      setNotification({ type: 'error', message: 'Connect your wallet and enter a valid device address first.' });
      return false;
    }
    return true;
  };

  const runTx = async (label: string, build: () => TransactionInstruction[], successMsg: string) => {
    if (!guard()) return;
    setBusy(label);
    setNotification(null);
    try {
      const tx = new Transaction();
      for (const ix of build()) tx.add(ix);
      const signature = await sendTransaction(tx, connection);
      setNotification({ type: 'success', message: successMsg, signature });
      // give devnet a moment, then refresh state
      setTimeout(refresh, 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setNotification({ type: 'error', message: `Transaction failed: ${msg}` });
    } finally {
      setBusy(null);
    }
  };

  const handleInitialize = () =>
    runTx('init', () => {
      const devicePubkey = new PublicKey(deviceInput.trim());
      const limitLamports = BigInt(Math.round(parseFloat(spendingLimitInput) * LAMPORTS_PER_SOL));
      const limitBuf = Buffer.alloc(8);
      limitBuf.writeBigUInt64LE(limitLamports);
      const data = Buffer.concat([
        Buffer.from(DISC.initialize, 'hex'),
        devicePubkey.toBuffer(),
        limitBuf,
      ]);
      return [
        new TransactionInstruction({
          programId: PROGRAM_KEY,
          keys: [
            { pubkey: new PublicKey(pdaAddress), isSigner: false, isWritable: true },
            { pubkey: publicKey!, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        }),
      ];
    }, 'Session vault initialized on-chain.');

  const handleDeposit = () =>
    runTx('deposit', () => {
      const lamports = Math.round(parseFloat(depositInput) * LAMPORTS_PER_SOL);
      return [
        SystemProgram.transfer({
          fromPubkey: publicKey!,
          toPubkey: new PublicKey(pdaAddress),
          lamports,
        }),
      ];
    }, `Deposited ${depositInput} SOL into the session vault.`);

  const handleRevoke = () =>
    runTx('revoke', () => [
      new TransactionInstruction({
        programId: PROGRAM_KEY,
        keys: [
          { pubkey: new PublicKey(pdaAddress), isSigner: false, isWritable: true },
          { pubkey: publicKey!, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(DISC.close, 'hex'),
      }),
    ], 'Session revoked — rent and remaining funds returned to your wallet.');

  // ----- Derived view state -----

  const sessionActive = session !== null;
  const spentPct = session && session.spendingLimit > 0
    ? Math.min(100, (session.totalSpent / session.spendingLimit) * 100)
    : 0;

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <Link href="/" className="brand">
          <img src="/logo.png" alt="RoboWallet Logo" className="brand-logo" />
          <span>RoboWallet</span>
        </Link>
        <nav className="sidebar-nav">
          <span className="nav-link active"><span>📊</span> Fleet Dashboard</span>
          <Link href="/docs" className="nav-link"><span>📖</span> API Docs</Link>
          <a href="https://github.com/SolM2M-Labs/robowallet-core" target="_blank" rel="noopener noreferrer" className="nav-link">
            <span>🛠️</span> GitHub
          </a>
          <a href="https://x.com/RoboWallet_sdk" target="_blank" rel="noopener noreferrer" className="nav-link">
            <span>🐦</span> Twitter
          </a>
          <Link href="/" className="nav-link nav-home"><span>🏠</span> Back to Home</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-bar">
          <div>
            <h1 className="page-title">Fleet Overview</h1>
            {publicKey && (
              <p className="identity-line">Identity: {shortAddr(publicKey.toBase58(), 8)}</p>
            )}
          </div>
          <div className="wallet-btn-wrap">
            <WalletMultiButton />
          </div>
        </header>

        {notification && (
          <div className={`notice ${notification.type === 'success' ? 'notice-success' : 'notice-error'}`}>
            <div>
              <strong>{notification.type === 'success' ? '🚀 Success:' : '❌ Error:'}</strong>{' '}
              {notification.message}
              {notification.signature && (
                <>
                  {' '}
                  <a
                    className="notice-link"
                    href={`https://explorer.solana.com/tx/${notification.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Explorer ({shortAddr(notification.signature, 6)})
                  </a>
                </>
              )}
            </div>
            <button className="notice-close" onClick={() => setNotification(null)}>×</button>
          </div>
        )}

        {/* Top Metrics Grid */}
        <div className="grid-container">
          {/* Network Status */}
          <div className={`glass-panel ${networkStatus.includes('Connected') ? 'edge-green' : 'edge-yellow'}`}>
            <div className="panel-header">
              <span>Network Status</span>
              <span className={`badge ${networkStatus.includes('Connected') ? 'badge-green' : 'badge-yellow'}`}>
                {networkStatus.includes('Connected') && <span className="pulse-dot" />}
                {networkStatus}
              </span>
            </div>
            <div className="panel-value slot-value">
              {currentSlot ? `Slot ${currentSlot.toLocaleString()}` : 'Syncing…'}
            </div>
            <div className="mono-sub">
              Program: <a
                className="addr-link"
                href={`https://explorer.solana.com/address/${ROBOWALLET_PROGRAM_ID}?cluster=devnet`}
                target="_blank" rel="noopener noreferrer"
              >{shortAddr(ROBOWALLET_PROGRAM_ID, 8)}</a>
            </div>
          </div>

          {/* Session Vault */}
          <div className={`glass-panel ${sessionActive ? 'edge-purple' : ''}`}>
            <div className="panel-header">
              <span>Session PDA Vault</span>
              <span className={`badge ${sessionActive ? 'badge-purple' : 'badge-dim'}`}>
                {sessionActive ? 'Active' : publicKey ? 'No Session' : 'Wallet Not Connected'}
              </span>
            </div>

            <div className="vault-addr">
              {pdaAddress === 'invalid'
                ? 'Invalid device address'
                : pdaAddress
                  ? <a className="addr-link" href={`https://explorer.solana.com/address/${pdaAddress}?cluster=devnet`} target="_blank" rel="noopener noreferrer">{shortAddr(pdaAddress, 10)}</a>
                  : 'Connect wallet to derive vault'}
            </div>

            <div className="vault-balance">
              Balance: <strong>{pdaBalance !== null ? `${pdaBalance.toFixed(4)} SOL` : '—'}</strong>
            </div>

            {session && (
              <>
                <div className="progress-row">
                  <span>Spent {(session.totalSpent / LAMPORTS_PER_SOL).toFixed(4)} / {(session.spendingLimit / LAMPORTS_PER_SOL).toFixed(4)} SOL</span>
                  <span>{spentPct.toFixed(0)}%</span>
                </div>
                <div className="progress-track">
                  <div className={`progress-fill ${spentPct >= 90 ? 'fill-red' : spentPct >= 60 ? 'fill-yellow' : ''}`} style={{ width: `${spentPct}%` }} />
                </div>
                <div className="vault-actions">
                  <input
                    type="number" step="0.01" min="0"
                    className="input-field input-small"
                    value={depositInput}
                    onChange={(e) => setDepositInput(e.target.value)}
                    placeholder="SOL"
                  />
                  <button className="btn btn-purple" onClick={handleDeposit} disabled={busy !== null}>
                    {busy === 'deposit' ? 'Depositing…' : 'Deposit'}
                  </button>
                  <button className="btn btn-red" onClick={handleRevoke} disabled={busy !== null}>
                    {busy === 'revoke' ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Initialize Session */}
          <div className="glass-panel edge-purple">
            <div className="panel-header"><span>🔑 Initialize Session Vault</span></div>
            <div className="form-stack">
              <label className="field-label">Device public key</label>
              <input
                type="text"
                className="input-field"
                placeholder="Device Public Key (Base58)"
                value={deviceInput}
                onChange={(e) => setDeviceInput(e.target.value)}
              />
              <label className="field-label">Spending limit (SOL)</label>
              <div className="form-row">
                <input
                  type="number" step="0.01" min="0"
                  className="input-field"
                  placeholder="Limit (SOL)"
                  value={spendingLimitInput}
                  onChange={(e) => setSpendingLimitInput(e.target.value)}
                />
                <button
                  className="btn btn-solid-purple"
                  onClick={handleInitialize}
                  disabled={busy !== null || !publicKey || sessionActive}
                  title={sessionActive ? 'Session already exists for this device' : undefined}
                >
                  {busy === 'init' ? 'Wait…' : sessionActive ? 'Active' : 'Initialize'}
                </button>
              </div>
              {!publicKey && <p className="hint-line">Connect a wallet to create a session.</p>}
            </div>
          </div>
        </div>

        {/* Decoded Activity Feed */}
        <div className="glass-panel activity-panel">
          <div className="panel-header">
            <span>Program Activity (Devnet)</span>
            <span className="badge badge-green"><span className="pulse-dot" /> Live</span>
          </div>

          <ul className="feed-list">
            {activity.length > 0 ? (
              activity.map((entry) => {
                const meta = KIND_META[entry.kind];
                return (
                  <li className="activity-item" key={entry.signature}>
                    <span className={`icon-bubble ${meta.className}`}>{meta.icon}</span>
                    <div className="activity-main">
                      <div className="activity-title">
                        {meta.label}
                        {entry.amount !== null && (
                          <span className="activity-amount">
                            {entry.kind === 'initialize' ? ' · limit ' : ' · '}
                            {(entry.amount / LAMPORTS_PER_SOL).toFixed(4)} SOL
                          </span>
                        )}
                      </div>
                      <a
                        className="activity-sig"
                        href={`https://explorer.solana.com/tx/${entry.signature}?cluster=devnet`}
                        target="_blank" rel="noopener noreferrer"
                      >
                        {shortAddr(entry.signature, 10)}
                      </a>
                    </div>
                    <div className="activity-side">
                      <span className={`badge ${entry.err ? 'badge-red' : 'badge-green'}`}>
                        {entry.err ? 'Failed' : 'Success'}
                      </span>
                      <span className="activity-time">{timeAgo(entry.blockTime)}</span>
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="empty-state">
                {activityLoaded ? 'No transactions found for this program yet.' : 'Loading on-chain activity…'}
              </li>
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
