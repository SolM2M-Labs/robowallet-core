//! C/C++ Foreign Function Interface (FFI) Wrapper
//! Allows Arduino and ESP-IDF C++ projects to call the RoboWallet Rust Core.
//!
//! All functions return >= 0 on success and a negative error code on failure:
//!   -1 = null pointer / bad argument
//!   -2 = output buffer too small
//!   -3 = serialization failed

use ed25519_dalek::SigningKey;

use crate::crypto::RoboKeypair;
use crate::encoding::base58_encode;
use crate::transaction::{build_execute_payment, build_signed_transfer};

unsafe fn read_array<const N: usize>(ptr: *const u8) -> [u8; N] {
    let mut arr = [0u8; N];
    core::ptr::copy_nonoverlapping(ptr, arr.as_mut_ptr(), N);
    arr
}

/// Derives the 32-byte Ed25519 public key from a 32-byte seed.
#[no_mangle]
pub extern "C" fn rw_pubkey_from_seed(seed: *const u8, out_pubkey: *mut u8) -> i32 {
    if seed.is_null() || out_pubkey.is_null() {
        return -1;
    }
    let seed_arr: [u8; 32] = unsafe { read_array(seed) };
    let keypair = RoboKeypair::from_seed(&seed_arr);
    unsafe {
        core::ptr::copy_nonoverlapping(keypair.public.as_bytes().as_ptr(), out_pubkey, 32);
    }
    0
}

/// Encodes a 32-byte public key as a null-terminated Base58 string.
/// Returns the string length on success.
#[no_mangle]
pub extern "C" fn rw_address_base58(
    pubkey: *const u8,
    out_str: *mut u8,
    out_capacity: usize,
) -> i32 {
    if pubkey.is_null() || out_str.is_null() {
        return -1;
    }
    if out_capacity < 45 {
        return -2; // up to 44 chars + null terminator
    }
    let key: [u8; 32] = unsafe { read_array(pubkey) };
    let mut encoded = [0u8; 64];
    let len = match base58_encode(&key, &mut encoded) {
        Ok(l) => l,
        Err(_) => return -3,
    };
    unsafe {
        core::ptr::copy_nonoverlapping(encoded.as_ptr(), out_str, len);
        *out_str.add(len) = 0;
    }
    len as i32
}

/// Builds a fully-signed Solana SOL transfer transaction.
/// Writes the wire-format transaction bytes into `out_tx` and returns the byte length.
/// The result can be base64-encoded and broadcast via `sendTransaction` as-is.
#[no_mangle]
pub extern "C" fn rw_build_signed_transfer(
    seed: *const u8,
    receiver_pubkey: *const u8,
    amount_lamports: u64,
    recent_blockhash: *const u8,
    out_tx: *mut u8,
    out_capacity: usize,
) -> i32 {
    if seed.is_null() || receiver_pubkey.is_null() || recent_blockhash.is_null() || out_tx.is_null()
    {
        return -1;
    }
    let seed_arr: [u8; 32] = unsafe { read_array(seed) };
    let receiver: [u8; 32] = unsafe { read_array(receiver_pubkey) };
    let blockhash: [u8; 32] = unsafe { read_array(recent_blockhash) };

    let signing_key = SigningKey::from_bytes(&seed_arr);
    let mut buf = [0u8; 512];
    let len = match build_signed_transfer(&signing_key, &receiver, amount_lamports, &blockhash, &mut buf)
    {
        Ok(l) => l,
        Err(_) => return -3,
    };
    if len > out_capacity {
        return -2;
    }
    unsafe {
        core::ptr::copy_nonoverlapping(buf.as_ptr(), out_tx, len);
    }
    len as i32
}

/// Builds a fully-signed `execute_payment` transaction for the RoboWallet
/// on-chain program (session-key vault spend). Returns the byte length.
#[no_mangle]
pub extern "C" fn rw_build_execute_payment(
    device_seed: *const u8,
    program_id: *const u8,
    session_pda: *const u8,
    target_pubkey: *const u8,
    amount_lamports: u64,
    recent_blockhash: *const u8,
    out_tx: *mut u8,
    out_capacity: usize,
) -> i32 {
    if device_seed.is_null()
        || program_id.is_null()
        || session_pda.is_null()
        || target_pubkey.is_null()
        || recent_blockhash.is_null()
        || out_tx.is_null()
    {
        return -1;
    }
    let seed_arr: [u8; 32] = unsafe { read_array(device_seed) };
    let program: [u8; 32] = unsafe { read_array(program_id) };
    let pda: [u8; 32] = unsafe { read_array(session_pda) };
    let target: [u8; 32] = unsafe { read_array(target_pubkey) };
    let blockhash: [u8; 32] = unsafe { read_array(recent_blockhash) };

    let signing_key = SigningKey::from_bytes(&seed_arr);
    let mut buf = [0u8; 512];
    let len = match build_execute_payment(
        &signing_key,
        &program,
        &pda,
        &target,
        amount_lamports,
        &blockhash,
        &mut buf,
    ) {
        Ok(l) => l,
        Err(_) => return -3,
    };
    if len > out_capacity {
        return -2;
    }
    unsafe {
        core::ptr::copy_nonoverlapping(buf.as_ptr(), out_tx, len);
    }
    len as i32
}

/// Legacy helper: writes the deterministic TEST wallet's Base58 address.
/// Kept for backwards compatibility with existing sketches.
#[no_mangle]
pub extern "C" fn rw_generate_test_wallet(out_address_buffer: *mut u8, buffer_len: usize) -> i32 {
    if out_address_buffer.is_null() {
        return -1;
    }
    if buffer_len < 45 {
        return -2;
    }
    let keypair = RoboKeypair::generate_test_keypair();
    rw_address_base58(
        keypair.public.as_bytes().as_ptr(),
        out_address_buffer,
        buffer_len,
    )
}
