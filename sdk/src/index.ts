/**
 * robowallet-sdk — TypeScript helpers for the RoboWallet on-chain program.
 *
 * Build session-key vault transactions for machine-to-machine payments on
 * Solana: derive the session PDA, create instructions, and decode vault state.
 * Framework-agnostic; bring your own Connection and signer.
 *
 * @packageDocumentation
 */

import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';

/** Deployed RoboWallet program (Solana devnet). */
export const ROBOWALLET_PROGRAM_ID = new PublicKey(
  'ArgvLnQ5UhqJ9Ks7JF7nycbUJNzAgwR136LqzBNCCux9'
);

/** Anchor instruction discriminators (sha256("global:<name>")[..8]). */
export const DISCRIMINATOR = {
  initializeSession: Uint8Array.from([0x45, 0x82, 0x5c, 0xec, 0x6b, 0xe7, 0x9f, 0x81]),
  executePayment: Uint8Array.from([0x56, 0x04, 0x07, 0x07, 0x78, 0x8b, 0xe8, 0x8b]),
  closeSession: Uint8Array.from([0x44, 0x72, 0xb2, 0x8c, 0xde, 0x26, 0xf8, 0xd3]),
} as const;

/** Decoded `SessionState` account. */
export interface SessionState {
  owner: PublicKey;
  /** Authorized device (hardware) public key. */
  deviceKey: PublicKey;
  /** Maximum total lamports the device may ever spend from the vault. */
  spendingLimit: bigint;
  /** Lamports spent so far. */
  totalSpent: bigint;
  /** PDA bump seed. */
  bump: number;
}

function u64le(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, value, true);
  return buf;
}

function concat(...parts: Uint8Array[]): Buffer {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return Buffer.from(out);
}

/**
 * Derives the session-vault PDA for an (owner, device) pair.
 * Seeds: `["session", owner, device]`.
 */
export function deriveSessionPda(
  owner: PublicKey,
  device: PublicKey,
  programId: PublicKey = ROBOWALLET_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('session'), owner.toBuffer(), device.toBuffer()],
    programId
  );
}

/**
 * Builds the `initialize_session` instruction. The owner creates a vault bound
 * to `device` with a hard `spendingLimit` (in lamports) enforced on-chain.
 */
export function initializeSessionInstruction(params: {
  owner: PublicKey;
  device: PublicKey;
  spendingLimit: bigint | number;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId ?? ROBOWALLET_PROGRAM_ID;
  const [pda] = deriveSessionPda(params.owner, params.device, programId);
  const data = concat(
    DISCRIMINATOR.initializeSession,
    params.device.toBuffer(),
    u64le(BigInt(params.spendingLimit))
  );
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: params.owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Builds the `execute_payment` instruction. The device signs this itself; the
 * program enforces `totalSpent + amount <= spendingLimit` and moves lamports
 * from the vault to `target`.
 */
export function executePaymentInstruction(params: {
  owner: PublicKey;
  device: PublicKey;
  target: PublicKey;
  amount: bigint | number;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId ?? ROBOWALLET_PROGRAM_ID;
  const [pda] = deriveSessionPda(params.owner, params.device, programId);
  const data = concat(DISCRIMINATOR.executePayment, u64le(BigInt(params.amount)));
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: params.device, isSigner: true, isWritable: false },
      { pubkey: params.target, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Builds the `close_session` instruction. The owner revokes the vault and
 * recovers its rent plus any unspent balance.
 */
export function closeSessionInstruction(params: {
  owner: PublicKey;
  device: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId ?? ROBOWALLET_PROGRAM_ID;
  const [pda] = deriveSessionPda(params.owner, params.device, programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: params.owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(DISCRIMINATOR.closeSession),
  });
}

/**
 * Decodes a raw `SessionState` account buffer.
 * Layout: discriminator(8) owner(32) device(32) limit(u64) spent(u64) bump(1).
 */
export function decodeSessionState(data: Uint8Array): SessionState {
  if (data.length < 89) {
    throw new Error(`SessionState buffer too small: ${data.length} bytes (need >= 89)`);
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    owner: new PublicKey(data.slice(8, 40)),
    deviceKey: new PublicKey(data.slice(40, 72)),
    spendingLimit: view.getBigUint64(72, true),
    totalSpent: view.getBigUint64(80, true),
    bump: data[88],
  };
}

/** Lamports still spendable for a decoded session (limit − spent). */
export function remainingBudget(state: SessionState): bigint {
  return state.spendingLimit - state.totalSpent;
}
