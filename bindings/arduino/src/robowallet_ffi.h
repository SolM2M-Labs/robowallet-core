/*
 * RoboWallet Core — C FFI declarations
 * Implemented by librobowallet_core.a (no_std Rust, riscv32imc).
 *
 * All functions return >= 0 on success, negative on error:
 *   -1 = null pointer / bad argument
 *   -2 = output buffer too small
 *   -3 = serialization failed
 */
#ifndef ROBOWALLET_FFI_H
#define ROBOWALLET_FFI_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Derives the 32-byte Ed25519 public key from a 32-byte seed. */
int32_t rw_pubkey_from_seed(const uint8_t* seed, uint8_t* out_pubkey);

/* Encodes a 32-byte public key as a null-terminated Base58 string.
 * Returns the string length. out_capacity must be >= 45. */
int32_t rw_address_base58(const uint8_t* pubkey, uint8_t* out_str, size_t out_capacity);

/* Builds a fully-signed Solana SOL transfer (wire format, ready to broadcast).
 * Returns the transaction byte length written to out_tx. */
int32_t rw_build_signed_transfer(
    const uint8_t* seed,
    const uint8_t* receiver_pubkey,
    uint64_t amount_lamports,
    const uint8_t* recent_blockhash,
    uint8_t* out_tx,
    size_t out_capacity);

/* Builds a fully-signed execute_payment call to the RoboWallet on-chain
 * program (session-key vault spend). Returns the transaction byte length. */
int32_t rw_build_execute_payment(
    const uint8_t* device_seed,
    const uint8_t* program_id,
    const uint8_t* session_pda,
    const uint8_t* target_pubkey,
    uint64_t amount_lamports,
    const uint8_t* recent_blockhash,
    uint8_t* out_tx,
    size_t out_capacity);

/* Legacy: writes the deterministic TEST wallet address (Base58, null-terminated).
 * Returns the string length. Test/demo only — never fund this key. */
int32_t rw_generate_test_wallet(uint8_t* out_address_buffer, size_t buffer_len);

#ifdef __cplusplus
}
#endif

#endif /* ROBOWALLET_FFI_H */
