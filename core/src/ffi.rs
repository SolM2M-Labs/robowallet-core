//! C/C++ Foreign Function Interface (FFI) Wrapper
//! Allows Arduino and ESP-IDF C++ projects to call the RoboWallet Rust Core.

use crate::crypto::RoboKeypair;
use crate::transaction::SolTransferTx;

#[no_mangle]
pub extern "C" fn rw_generate_test_wallet(out_address_buffer: *mut u8, buffer_len: usize) -> i32 {
    if buffer_len < 45 || out_address_buffer.is_null() {
        return -1; // Buffer too small for Base58 address
    }

    let keypair = RoboKeypair::generate_test_keypair();
    let mut b58_buffer = [0u8; 64];
    let len = keypair.get_pubkey_string(&mut b58_buffer).unwrap_or(0);

    // Unsafe block to write back to the C-allocated pointer
    unsafe {
        let max_len = core::cmp::min(len, buffer_len);
        let src_ptr = b58_buffer.as_ptr();
        core::ptr::copy_nonoverlapping(src_ptr, out_address_buffer, max_len);
        
        // Null-terminate the string for C++
        if max_len < buffer_len {
            *out_address_buffer.add(max_len) = 0;
        }
    }

    0 // Success
}

#[no_mangle]
pub extern "C" fn rw_build_and_sign_transfer(
    receiver_address: *const u8,
    amount_lamports: u64,
    recent_blockhash: *const u8
) -> i32 {
    if receiver_address.is_null() || recent_blockhash.is_null() {
        return -1;
    }

    // Parse inputs from C
    let mut receiver_arr = [0u8; 32];
    let mut blockhash_arr = [0u8; 32];
    
    unsafe {
        core::ptr::copy_nonoverlapping(receiver_address, receiver_arr.as_mut_ptr(), 32);
        core::ptr::copy_nonoverlapping(recent_blockhash, blockhash_arr.as_mut_ptr(), 32);
    }

    let keypair = RoboKeypair::generate_test_keypair();
    
    let tx = SolTransferTx::new(
        *keypair.public.as_bytes(),
        receiver_arr,
        amount_lamports,
        blockhash_arr
    );

    tx.sign_and_build(&keypair.secret);

    0 // Success
}
