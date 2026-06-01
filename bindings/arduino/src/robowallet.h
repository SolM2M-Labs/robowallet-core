#ifndef ROBOWALLET_CPP_H
#define ROBOWALLET_CPP_H

#include <Arduino.h>
#include "robowallet.h"

class RoboWallet {
public:
    RoboWallet();

    /**
     * @brief Generates a test wallet address.
     * @return String representing the base58 wallet address.
     */
    String generateTestWallet();

    /**
     * @brief Constructs and signs a SOL transfer transaction payload.
     * @param receiverPubKey 32-byte array representing receiver public key.
     * @param amountLamports Transfer amount in lamports (1 SOL = 1,000,000,000 lamports).
     * @param blockhash32Bytes 32-byte array representing a recent blockhash.
     * @return True if transaction built and signed successfully, false otherwise.
     */
    bool buildAndSignTransfer(const uint8_t* receiverPubKey, uint64_t amountLamports, const uint8_t* blockhash32Bytes);

    /**
     * @brief Returns the cached wallet address base58 string.
     */
    String getAddress() const { return _address; }

private:
    String _address;
};

#endif // ROBOWALLET_CPP_H
