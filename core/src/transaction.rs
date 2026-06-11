//! Real Solana legacy transaction construction (no_std, stack-only).
//!
//! Produces byte-exact signed transactions ready for `sendTransaction`:
//!
//! ```text
//! [signature count: compact-u16][signature: 64 bytes][message]
//! message = [header: 3 bytes]
//!           [account keys: compact-u16 count + 32 bytes each]
//!           [recent blockhash: 32 bytes]
//!           [instructions: compact-u16 count +
//!             (program index: u8,
//!              account indices: compact-u16 count + u8 each,
//!              data: compact-u16 len + bytes)]
//! ```

use ed25519_dalek::{Signer, SigningKey};

use crate::encoding::encode_compact_u16;

/// System Program: 11111111111111111111111111111111
pub const SYSTEM_PROGRAM_ID: [u8; 32] = [0u8; 32];

/// Anchor discriminator for robowallet_program::execute_payment
/// (first 8 bytes of sha256("global:execute_payment"))
pub const EXECUTE_PAYMENT_DISCRIMINATOR: [u8; 8] = [0x56, 0x04, 0x07, 0x07, 0x78, 0x8b, 0xe8, 0x8b];

const SIGNATURE_LEN: usize = 64;
/// 1 byte signature count + one 64-byte signature
const SIG_SECTION_LEN: usize = 1 + SIGNATURE_LEN;

struct Writer<'a> {
    buf: &'a mut [u8],
    pos: usize,
}

impl<'a> Writer<'a> {
    fn new(buf: &'a mut [u8]) -> Self {
        Self { buf, pos: 0 }
    }

    fn write(&mut self, bytes: &[u8]) -> Result<(), ()> {
        if self.pos + bytes.len() > self.buf.len() {
            return Err(());
        }
        self.buf[self.pos..self.pos + bytes.len()].copy_from_slice(bytes);
        self.pos += bytes.len();
        Ok(())
    }

    fn write_u8(&mut self, byte: u8) -> Result<(), ()> {
        self.write(&[byte])
    }

    fn write_compact_u16(&mut self, value: u16) -> Result<(), ()> {
        let mut tmp = [0u8; 3];
        let n = encode_compact_u16(value, &mut tmp)?;
        self.write(&tmp[..n])
    }
}

/// Message header: (required signatures, readonly signed, readonly unsigned)
type Header = (u8, u8, u8);

/// Serializes and signs a single-signer, single-instruction transaction.
/// The signer's pubkey must be `keys[0]` (the fee payer).
/// Returns the total transaction length written into `out`.
fn build_single_ix_tx(
    signing_key: &SigningKey,
    keys: &[[u8; 32]],
    header: Header,
    program_index: u8,
    account_indices: &[u8],
    data: &[u8],
    recent_blockhash: &[u8; 32],
    out: &mut [u8],
) -> Result<usize, ()> {
    if out.len() < SIG_SECTION_LEN {
        return Err(());
    }
    let (sig_section, msg_section) = out.split_at_mut(SIG_SECTION_LEN);

    // --- Serialize the message ---
    let mut w = Writer::new(msg_section);
    w.write(&[header.0, header.1, header.2])?;
    w.write_compact_u16(keys.len() as u16)?;
    for key in keys {
        w.write(key)?;
    }
    w.write(recent_blockhash)?;
    w.write_compact_u16(1)?; // one instruction
    w.write_u8(program_index)?;
    w.write_compact_u16(account_indices.len() as u16)?;
    w.write(account_indices)?;
    w.write_compact_u16(data.len() as u16)?;
    w.write(data)?;
    let msg_len = w.pos;

    // --- Sign the message bytes and prepend the signature section ---
    let signature = signing_key.sign(&msg_section[..msg_len]);
    sig_section[0] = 1; // compact-u16 signature count (always < 128 here)
    sig_section[1..].copy_from_slice(&signature.to_bytes());

    Ok(SIG_SECTION_LEN + msg_len)
}

/// Builds a fully-signed System Program SOL transfer.
/// Accounts: [sender (signer, writable), receiver (writable), system program].
pub fn build_signed_transfer(
    signing_key: &SigningKey,
    receiver: &[u8; 32],
    lamports: u64,
    recent_blockhash: &[u8; 32],
    out: &mut [u8],
) -> Result<usize, ()> {
    let sender = signing_key.verifying_key().to_bytes();

    // SystemInstruction::Transfer = enum index 2 (u32 LE) + lamports (u64 LE)
    let mut data = [0u8; 12];
    data[0..4].copy_from_slice(&2u32.to_le_bytes());
    data[4..12].copy_from_slice(&lamports.to_le_bytes());

    build_single_ix_tx(
        signing_key,
        &[sender, *receiver, SYSTEM_PROGRAM_ID],
        (1, 0, 1),
        2,       // program = keys[2]
        &[0, 1], // transfer accounts: [sender, receiver]
        &data,
        recent_blockhash,
        out,
    )
}

/// Builds a fully-signed `execute_payment` call to the RoboWallet Anchor program.
/// The device key signs and pays the fee; funds move from the session PDA vault to `target`.
pub fn build_execute_payment(
    device_signing_key: &SigningKey,
    program_id: &[u8; 32],
    session_pda: &[u8; 32],
    target: &[u8; 32],
    amount_lamports: u64,
    recent_blockhash: &[u8; 32],
    out: &mut [u8],
) -> Result<usize, ()> {
    let device = device_signing_key.verifying_key().to_bytes();

    let mut data = [0u8; 16];
    data[..8].copy_from_slice(&EXECUTE_PAYMENT_DISCRIMINATOR);
    data[8..].copy_from_slice(&amount_lamports.to_le_bytes());

    // keys: [device (signer, fee payer), session PDA (writable), target (writable),
    //        robowallet program (readonly), system program (readonly)]
    build_single_ix_tx(
        device_signing_key,
        &[device, *session_pda, *target, *program_id, SYSTEM_PROGRAM_ID],
        (1, 0, 2),
        3, // program = keys[3]
        // Anchor account order: [session_state, device_signer, target, system_program]
        &[1, 0, 2, 4],
        &data,
        recent_blockhash,
        out,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::Verifier;

    fn test_key() -> SigningKey {
        let mut seed = [0u8; 32];
        for (i, b) in seed.iter_mut().enumerate() {
            *b = (i + 1) as u8;
        }
        SigningKey::from_bytes(&seed)
    }

    #[test]
    fn transfer_tx_layout_and_signature() {
        let key = test_key();
        let receiver = [7u8; 32];
        let blockhash = [9u8; 32];
        let mut buf = [0u8; 512];

        let len = build_signed_transfer(&key, &receiver, 5_000_000, &blockhash, &mut buf).unwrap();

        // sig section: count + 64 bytes
        assert_eq!(buf[0], 1);
        // header
        assert_eq!(&buf[65..68], &[1, 0, 1]);
        // 3 account keys
        assert_eq!(buf[68], 3);
        assert_eq!(&buf[69..101], key.verifying_key().as_bytes());
        assert_eq!(&buf[101..133], &receiver);
        assert_eq!(&buf[133..165], &SYSTEM_PROGRAM_ID);
        // blockhash
        assert_eq!(&buf[165..197], &blockhash);
        // 1 instruction, program idx 2, 2 accounts [0,1], 12 bytes data
        assert_eq!(&buf[197..203], &[1, 2, 2, 0, 1, 12]);
        // data: tag 2 + lamports LE
        assert_eq!(&buf[203..207], &2u32.to_le_bytes());
        assert_eq!(&buf[207..215], &5_000_000u64.to_le_bytes());
        assert_eq!(len, 215);

        // signature must verify over the message bytes
        let sig = ed25519_dalek::Signature::from_bytes(buf[1..65].try_into().unwrap());
        key.verifying_key().verify(&buf[65..len], &sig).unwrap();
    }

    #[test]
    fn execute_payment_tx_layout() {
        let key = test_key();
        let program = [3u8; 32];
        let pda = [4u8; 32];
        let target = [5u8; 32];
        let blockhash = [9u8; 32];
        let mut buf = [0u8; 512];

        let len =
            build_execute_payment(&key, &program, &pda, &target, 10_000, &blockhash, &mut buf)
                .unwrap();

        assert_eq!(&buf[65..68], &[1, 0, 2]); // header
        assert_eq!(buf[68], 5); // five account keys
        // instruction section: count=1, program idx 3, 4 accounts [1,0,2,4], 16 data bytes
        let ix_start = 65 + 3 + 1 + 5 * 32 + 32;
        assert_eq!(
            &buf[ix_start..ix_start + 8],
            &[1, 3, 4, 1, 0, 2, 4, 16]
        );
        assert_eq!(&buf[ix_start + 8..ix_start + 16], &EXECUTE_PAYMENT_DISCRIMINATOR);
        assert_eq!(&buf[ix_start + 16..ix_start + 24], &10_000u64.to_le_bytes());
        assert_eq!(len, ix_start + 24);
    }
}
