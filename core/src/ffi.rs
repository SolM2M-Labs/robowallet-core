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
    let address = keypair.get_solana_address(&mut b58_buffer);

    // Unsafe block to write back to the C-allocated pointer
    unsafe {
        let out_slice = core::slice::from_raw_parts_mut(out_address_buffer, buffer_len);
        let address_bytes = address.as_bytes();
        let len = address_bytes.len();
        
        if len > buffer_len {
            return -1;
        }
        
        out_slice[..len].copy_from_slice(address_bytes);
        // Null terminate for C-string compatibility
        if len < buffer_len {
            out_slice[len] = 0;
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
