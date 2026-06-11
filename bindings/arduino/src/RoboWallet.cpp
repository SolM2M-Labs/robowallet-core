#include "robowallet.h"

RoboWallet::RoboWallet() : _hasSeed(false), _address("") {
    memset(_seed, 0, sizeof(_seed));
}

bool RoboWallet::setSeed(const uint8_t* seed32) {
    if (seed32 == nullptr) {
        return false;
    }
    memcpy(_seed, seed32, 32);
    _hasSeed = true;
    return deriveAddress();
}

bool RoboWallet::deriveAddress() {
    uint8_t pubkey[32];
    if (rw_pubkey_from_seed(_seed, pubkey) < 0) {
        _address = "";
        return false;
    }
    uint8_t buffer[64];
    memset(buffer, 0, sizeof(buffer));
    if (rw_address_base58(pubkey, buffer, sizeof(buffer)) < 0) {
        _address = "";
        return false;
    }
    _address = String((char*)buffer);
    return true;
}

String RoboWallet::generateTestWallet() {
    // Deterministic test seed [1..32] — matches the Rust core's test keypair.
    uint8_t seed[32];
    for (int i = 0; i < 32; i++) {
        seed[i] = (uint8_t)(i + 1);
    }
    setSeed(seed);
    return _address;
}

int32_t RoboWallet::buildSignedTransfer(const uint8_t* receiverPubKey, uint64_t amountLamports,
                                        const uint8_t* blockhash32Bytes,
                                        uint8_t* outTx, size_t outCapacity) {
    if (!_hasSeed || receiverPubKey == nullptr || blockhash32Bytes == nullptr || outTx == nullptr) {
        return -1;
    }
    return rw_build_signed_transfer(_seed, receiverPubKey, amountLamports,
                                    blockhash32Bytes, outTx, outCapacity);
}

int32_t RoboWallet::buildExecutePayment(const uint8_t* programId, const uint8_t* sessionPda,
                                        const uint8_t* targetPubKey, uint64_t amountLamports,
                                        const uint8_t* blockhash32Bytes,
                                        uint8_t* outTx, size_t outCapacity) {
    if (!_hasSeed || programId == nullptr || sessionPda == nullptr ||
        targetPubKey == nullptr || blockhash32Bytes == nullptr || outTx == nullptr) {
        return -1;
    }
    return rw_build_execute_payment(_seed, programId, sessionPda, targetPubKey,
                                    amountLamports, blockhash32Bytes, outTx, outCapacity);
}
