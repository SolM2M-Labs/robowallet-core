#include "RoboWallet.h"

RoboWallet::RoboWallet() : _address("") {}

String RoboWallet::generateTestWallet() {
    uint8_t buffer[64];
    memset(buffer, 0, sizeof(buffer));
    int32_t result = rw_generate_test_wallet(buffer, sizeof(buffer));
    if (result == 0) {
        _address = String((char*)buffer);
    } else {
        _address = "";
    }
    return _address;
}

bool RoboWallet::buildAndSignTransfer(const uint8_t* receiverPubKey, uint64_t amountLamports, const uint8_t* blockhash32Bytes) {
    if (receiverPubKey == nullptr || blockhash32Bytes == nullptr) {
        return false;
    }
    int32_t result = rw_build_and_sign_transfer(receiverPubKey, amountLamports, blockhash32Bytes);
    return (result == 0);
}
