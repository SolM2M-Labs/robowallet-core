#include <RoboWallet.h>

// RoboWallet — Real Solana transaction construction on the device.
// The bytes printed by this sketch are a valid wire-format transaction:
// base64-encode them and POST to a Solana RPC via sendTransaction.

RoboWallet wallet;

void printHex(const uint8_t* data, int32_t len) {
  for (int32_t i = 0; i < len; i++) {
    if (data[i] < 0x10) Serial.print('0');
    Serial.print(data[i], HEX);
  }
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    ; // Wait for serial port to connect. Needed for native USB port only
  }

  Serial.println("RoboWallet — Real Solana TX on ESP32");
  Serial.println("----------------------------------------------");

  // 1. Derive the device identity from the hardware TRNG.
  // (Persist the seed in NVS/EFuse to keep the same address across boots.)
  uint8_t seed[32];
  for (int i = 0; i < 32; i += 4) {
    uint32_t r = esp_random();
    memcpy(seed + i, &r, 4);
  }
  if (!wallet.setSeed(seed)) {
    Serial.println("Failed to derive keypair!");
    return;
  }
  Serial.print("Device Solana Address: ");
  Serial.println(wallet.getAddress());

  // 2. Payment parameters (0.005 SOL)
  uint64_t amountLamports = 5000000;

  // Receiver public key (32 raw bytes — decode the Base58 address off-device)
  uint8_t receiver[32];
  for (int i = 0; i < 32; i++) {
    receiver[i] = i; // demo placeholder
  }

  // Recent blockhash: fetch via the getLatestBlockhash RPC in production.
  uint8_t blockhash[32];
  for (int i = 0; i < 32; i++) {
    blockhash[i] = 9; // demo placeholder — a real blockhash is required to broadcast
  }

  // 3. Build the fully-signed transaction (real Solana wire format)
  Serial.println("Building and signing transfer transaction...");
  uint8_t tx[256];
  int32_t txLen = wallet.buildSignedTransfer(receiver, amountLamports, blockhash, tx, sizeof(tx));

  if (txLen > 0) {
    Serial.print("Signed transaction (");
    Serial.print(txLen);
    Serial.println(" bytes):");
    printHex(tx, txLen);
    Serial.println("base64-encode + POST via sendTransaction to broadcast.");
  } else {
    Serial.print("Failed to build transaction, error: ");
    Serial.println(txLen);
  }
}

void loop() {
  delay(1000);
}
