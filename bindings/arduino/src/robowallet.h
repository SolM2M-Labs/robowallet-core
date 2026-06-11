#ifndef ROBOWALLET_CPP_H
#define ROBOWALLET_CPP_H

#include <Arduino.h>
#include "robowallet_ffi.h"

class RoboWallet {
public:
    RoboWallet();

    /**
     * @brief Sets the device's 32-byte Ed25519 seed and derives its Solana address.
     *        Feed this from the ESP32 TRNG (esp_random) or a secure element.
     * @return True if the keypair was derived successfully.
     */
    bool setSeed(const uint8_t* seed32);

    /**
     * @brief Loads the deterministic TEST keypair (seed = [1..32]).
     *        Demo only — never fund this key.
     * @return String representing the base58 wallet address.
     */
    String generateTestWallet();

    /**
     * @brief Builds a fully-signed SOL transfer transaction (Solana wire format).
     * @param receiverPubKey 32-byte receiver public key.
     * @param amountLamports Transfer amount in lamports (1 SOL = 1,000,000,000).
     * @param blockhash32Bytes 32-byte recent blockhash (see getLatestBlockhash RPC).
     * @param outTx Output buffer for the signed transaction bytes.
     * @param outCapacity Size of outTx (>= 256 recommended).
     * @return Transaction byte length, or negative error code.
     */
    int32_t buildSignedTransfer(const uint8_t* receiverPubKey, uint64_t amountLamports,
                                const uint8_t* blockhash32Bytes,
                                uint8_t* outTx, size_t outCapacity);

    /**
     * @brief Builds a fully-signed execute_payment call to the RoboWallet
     *        on-chain program — spends from the session PDA vault within
     *        the owner-approved limit.
     * @return Transaction byte length, or negative error code.
     */
    int32_t buildExecutePayment(const uint8_t* programId, const uint8_t* sessionPda,
                                const uint8_t* targetPubKey, uint64_t amountLamports,
                                const uint8_t* blockhash32Bytes,
                                uint8_t* outTx, size_t outCapacity);

    /**
     * @brief Returns the cached wallet address base58 string.
     */
    String getAddress() const { return _address; }

private:
    bool deriveAddress();

    uint8_t _seed[32];
    bool _hasSeed;
    String _address;
};

#endif // ROBOWALLET_CPP_H
