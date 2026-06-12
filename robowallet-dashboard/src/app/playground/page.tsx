"use client";

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { useCallback, useMemo, useState } from 'react';
import { ROBOWALLET_PROGRAM_ID, SOLANA_RPC_URL } from '../config';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const PROGRAM_KEY = new PublicKey(ROBOWALLET_PROGRAM_ID);

const DISC = {
  initialize: [0x45, 0x82, 0x5c, 0xec, 0x6b, 0xe7, 0x9f, 0x81],
  execute: [0x56, 0x04, 0x07, 0x07, 0x78, 0x8b, 0xe8, 0x8b],
  close: [0x44, 0x72, 0xb2, 0x8c, 0xde, 0x26, 0xf8, 0xd3],
};

// Demo parameters (kept tiny so devnet SOL lasts)
const LIMIT_SOL = 0.02;
const DEPOSIT_SOL = 0.03;
const DEVICE_FEE_SOL = 0.003; // funds the device so it can pay its own tx fees
const PAYMENT_SOL = 0.008;
const OVERLIMIT_SOL = 0.05; // exceeds the limit on purpose

function u64le(n: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(Math.round(n)));
  return buf;
}

function short(s: string, n = 4): string {
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

type LogKind = 'info' | 'success' | 'error' | 'pending';
interface LogEntry {
  kind: LogKind;
  text: string;
  signature?: string;
}

const KIND_ICON: Record<LogKind, string> = {
  info: '▹',
  success: '✓',
  error: '✕',
  pending: '⟳',
};

export default function Playground() {
  const { publicKey, sendTransaction } = useWallet();
  const connection = useMemo(() => new Connection(SOLANA_RPC_URL, 'confirmed'), []);

  // The in-browser "device" — a real Ed25519 keypair standing in for an ESP32.
  const [device, setDevice] = useState<Keypair | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [vaultBalance, setVaultBalance] = useState<number | null>(null);
  const [spent, setSpent] = useState(0);

  const pda = useMemo(() => {
    if (!publicKey || !device) return null;
    const [addr] = PublicKey.findProgramAddressSync(
      [Buffer.from('session'), publicKey.toBuffer(), device.publicKey.toBuffer()],
      PROGRAM_KEY
    );
    return addr;
  }, [publicKey, device]);

  const append = (entry: LogEntry) => setLog((l) => [...l, entry]);

  const refreshVault = useCallback(async () => {
    if (!pda) return;
    try {
      const info = await connection.getAccountInfo(pda);
      if (info) {
        setVaultBalance(info.lamports / LAMPORTS_PER_SOL);
        const data = new Uint8Array(info.data);
        if (data.length >= 88) {
          const view = new DataView(data.buffer, data.byteOffset + 80, 8);
          setSpent(Number(view.getBigUint64(0, true)) / LAMPORTS_PER_SOL);
        }
      } else {
        setVaultBalance(null);
      }
    } catch {
      /* ignore */
    }
  }, [connection, pda]);

  const generateDevice = () => {
    const kp = Keypair.generate();
    setDevice(kp);
    setSessionReady(false);
    setVaultBalance(null);
    setSpent(0);
    setLog([
      { kind: 'info', text: `New device booted. Its key was generated in your browser and never leaves it — exactly like an ESP32 deriving a key from its hardware TRNG.` },
      { kind: 'info', text: `Device address: ${kp.publicKey.toBase58()}` },
    ]);
  };

  // Step 1: owner (Phantom) initializes the vault, funds it, and gives the
  // device a little SOL for its own transaction fees — all in one transaction.
  const initializeSession = async () => {
    if (!publicKey || !device || !pda) return;
    setBusy('init');
    try {
      append({ kind: 'pending', text: 'Owner is initializing and funding the session vault…' });

      const initData = Buffer.concat([
        Buffer.from(DISC.initialize),
        device.publicKey.toBuffer(),
        u64le(LIMIT_SOL * LAMPORTS_PER_SOL),
      ]);
      const initIx = new TransactionInstruction({
        programId: PROGRAM_KEY,
        keys: [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: initData,
      });
      const fundVault = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: pda,
        lamports: Math.round(DEPOSIT_SOL * LAMPORTS_PER_SOL),
      });
      const fundDevice = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: device.publicKey,
        lamports: Math.round(DEVICE_FEE_SOL * LAMPORTS_PER_SOL),
      });

      const tx = new Transaction().add(initIx, fundVault, fundDevice);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');

      append({
        kind: 'success',
        text: `Vault live with a ${LIMIT_SOL} SOL spending limit and ${DEPOSIT_SOL} SOL deposited.`,
        signature: sig,
      });
      setSessionReady(true);
      await refreshVault();
    } catch (e: unknown) {
      append({ kind: 'error', text: `Initialize failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  };

  // Step 2: the DEVICE signs its own payment (Phantom is not involved).
  const devicePayment = async (amountSol: number, overLimit: boolean) => {
    if (!device || !pda) return;
    setBusy(overLimit ? 'over' : 'pay');
    try {
      append({
        kind: 'pending',
        text: overLimit
          ? `Device attempts an over-limit payment of ${amountSol} SOL…`
          : `Device signs and broadcasts a ${amountSol} SOL payment (no wallet popup — the device acts on its own)…`,
      });

      const target = Keypair.generate().publicKey; // e.g. a charging pad
      const execIx = new TransactionInstruction({
        programId: PROGRAM_KEY,
        keys: [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: device.publicKey, isSigner: true, isWritable: false },
          { pubkey: target, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([Buffer.from(DISC.execute), u64le(amountSol * LAMPORTS_PER_SOL)]),
      });

      const tx = new Transaction().add(execIx);
      tx.feePayer = device.publicKey;
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.sign(device);

      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, 'confirmed');

      append({
        kind: 'success',
        text: overLimit
          ? `Unexpected: the over-limit payment was accepted.`
          : `Payment settled on-chain — ${amountSol} SOL moved to ${short(target.toBase58())}.`,
        signature: sig,
      });
      await refreshVault();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (overLimit) {
        append({
          kind: 'success',
          text: `Rejected on-chain, exactly as intended — the program enforced the spending limit. The device cannot exceed the owner's budget.`,
        });
      } else {
        append({ kind: 'error', text: `Payment failed: ${msg}` });
      }
    } finally {
      setBusy(null);
    }
  };

  // Step 4: owner revokes, recovering rent + unspent funds.
  const revoke = async () => {
    if (!publicKey || !pda) return;
    setBusy('revoke');
    try {
      append({ kind: 'pending', text: 'Owner revokes the session…' });
      const closeIx = new TransactionInstruction({
        programId: PROGRAM_KEY,
        keys: [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(DISC.close),
      });
      const sig = await sendTransaction(new Transaction().add(closeIx), connection);
      await connection.confirmTransaction(sig, 'confirmed');
      append({ kind: 'success', text: 'Session revoked. Rent and unspent funds returned to the owner.', signature: sig });
      setSessionReady(false);
      setVaultBalance(null);
    } catch (e: unknown) {
      append({ kind: 'error', text: `Revoke failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const stepNum = !device ? 1 : !sessionReady ? 2 : 3;

  return (
    <div className="pg-wrap">
      <header className="pg-header">
        <Link href="/" className="pg-brand">
          <img src="/logo.png" alt="RoboWallet" className="brand-logo" />
          <span>RoboWallet</span>
        </Link>
        <nav className="pg-nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/docs">Docs</Link>
          <div className="wallet-btn-wrap"><WalletMultiButton /></div>
        </nav>
      </header>

      <main className="pg-main">
        <div className="pg-intro">
          <span className="badge badge-purple">⚡ Live on Devnet · No install</span>
          <h1 className="pg-title">Interactive Playground</h1>
          <p className="pg-sub">
            Watch a machine pay on Solana within an owner-set limit — and watch the chain reject it
            when it tries to overspend. Every action here is a real devnet transaction.
          </p>
        </div>

        <div className="pg-grid">
          {/* Controls */}
          <div className="glass-panel pg-controls">
            {!publicKey && (
              <div className="pg-step">
                <div className="pg-step-head"><span className="pg-num">0</span> Connect your wallet</div>
                <p className="hint-line">You play the <strong>owner</strong>. Set Phantom to Devnet and grab free SOL from faucet.solana.com.</p>
                <div className="wallet-btn-wrap" style={{ marginTop: 10 }}><WalletMultiButton /></div>
              </div>
            )}

            {publicKey && (
              <>
                <div className={`pg-step ${stepNum === 1 ? 'active' : ''}`}>
                  <div className="pg-step-head"><span className="pg-num">1</span> Boot a device</div>
                  <p className="hint-line">Generates an Ed25519 key in your browser — the stand-in for an ESP32.</p>
                  <button className="btn btn-purple" onClick={generateDevice} disabled={busy !== null}>
                    {device ? 'Boot a new device' : 'Boot device'}
                  </button>
                </div>

                <div className={`pg-step ${stepNum === 2 ? 'active' : ''} ${!device ? 'locked' : ''}`}>
                  <div className="pg-step-head"><span className="pg-num">2</span> Open &amp; fund the vault</div>
                  <p className="hint-line">Owner signs once: create the session ({LIMIT_SOL} SOL limit), deposit {DEPOSIT_SOL} SOL, and give the device fee money.</p>
                  <button className="btn btn-solid-purple" onClick={initializeSession} disabled={busy !== null || !device || sessionReady}>
                    {busy === 'init' ? 'Confirming…' : sessionReady ? 'Vault active' : 'Initialize & fund'}
                  </button>
                </div>

                <div className={`pg-step ${stepNum === 3 ? 'active' : ''} ${!sessionReady ? 'locked' : ''}`}>
                  <div className="pg-step-head"><span className="pg-num">3</span> Let the device pay</div>
                  <p className="hint-line">The device signs its own transactions — no wallet popup.</p>
                  <div className="pg-btn-row">
                    <button className="btn btn-purple" onClick={() => devicePayment(PAYMENT_SOL, false)} disabled={busy !== null || !sessionReady}>
                      {busy === 'pay' ? 'Paying…' : `Pay ${PAYMENT_SOL} SOL`}
                    </button>
                    <button className="btn btn-red" onClick={() => devicePayment(OVERLIMIT_SOL, true)} disabled={busy !== null || !sessionReady}>
                      {busy === 'over' ? 'Trying…' : `Try ${OVERLIMIT_SOL} SOL (over limit)`}
                    </button>
                  </div>
                  <button className="btn pg-revoke" onClick={revoke} disabled={busy !== null || !sessionReady}>
                    {busy === 'revoke' ? 'Revoking…' : 'Revoke & recover funds'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Live state */}
          <div className="glass-panel pg-state">
            <div className="panel-header"><span>Session State</span>
              {sessionReady && <span className="badge badge-green"><span className="pulse-dot" /> Active</span>}
            </div>
            <dl className="pg-kv">
              <dt>Owner</dt>
              <dd>{publicKey ? short(publicKey.toBase58(), 6) : '—'}</dd>
              <dt>Device</dt>
              <dd>{device ? short(device.publicKey.toBase58(), 6) : '—'}</dd>
              <dt>Vault PDA</dt>
              <dd>{pda ? (
                <a className="addr-link" href={`https://explorer.solana.com/address/${pda.toBase58()}?cluster=devnet`} target="_blank" rel="noopener noreferrer">{short(pda.toBase58(), 6)}</a>
              ) : '—'}</dd>
              <dt>Vault balance</dt>
              <dd>{vaultBalance !== null ? `${vaultBalance.toFixed(4)} SOL` : '—'}</dd>
            </dl>
            {sessionReady && (
              <>
                <div className="progress-row">
                  <span>Spent {spent.toFixed(4)} / {LIMIT_SOL.toFixed(4)} SOL</span>
                  <span>{Math.min(100, (spent / LIMIT_SOL) * 100).toFixed(0)}%</span>
                </div>
                <div className="progress-track">
                  <div className={`progress-fill ${spent / LIMIT_SOL >= 0.9 ? 'fill-red' : spent / LIMIT_SOL >= 0.6 ? 'fill-yellow' : ''}`} style={{ width: `${Math.min(100, (spent / LIMIT_SOL) * 100)}%` }} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Activity log */}
        <div className="glass-panel pg-log">
          <div className="panel-header"><span>Activity</span></div>
          {log.length === 0 ? (
            <p className="empty-state">Connect a wallet and boot a device to begin.</p>
          ) : (
            <ul className="pg-log-list">
              {log.map((e, i) => (
                <li key={i} className={`pg-log-item log-${e.kind}`}>
                  <span className="pg-log-icon">{KIND_ICON[e.kind]}</span>
                  <span className="pg-log-text">
                    {e.text}
                    {e.signature && (
                      <>
                        {' '}
                        <a className="addr-link" href={`https://explorer.solana.com/tx/${e.signature}?cluster=devnet`} target="_blank" rel="noopener noreferrer">
                          view tx ↗
                        </a>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
