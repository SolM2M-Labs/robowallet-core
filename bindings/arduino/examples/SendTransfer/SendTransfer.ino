#include <RoboWallet.h>

RoboWallet wallet;

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    ; // Wait for serial port to connect. Needed for native USB port only
  }

  Serial.println("🤖 RoboWallet Arduino IDE FFI Integration Test");
  Serial.println("----------------------------------------------");

  // 1. Generate a test wallet address
  Serial.print("Generating keypair... ");
  String address = wallet.generateTestWallet();
  Serial.println("Done!");
  Serial.print("Wallet Public Key (Base58): ");
  Serial.println(address);

  // 2. Prepare dummy payment parameters (0.005 SOL)
  uint64_t amountLamports = 5000000;
  
  // Dummy receiver public key (32 bytes)
  uint8_t receiver[32];
  for (int i = 0; i < 32; i++) {
    receiver[i] = i; // Mock receiver address
  }

  // Dummy recent blockhash (32 bytes, fetched from RPC in production)
  uint8_t blockhash[32];
  for (int i = 0; i < 32; i++) {
    blockhash[i] = 9; // Mock blockhash
  }

  // 3. Build and sign transaction
  Serial.println("Building and signing transfer transaction...");
  bool success = wallet.buildAndSignTransfer(receiver, amountLamports, blockhash);

  if (success) {
    Serial.println("✅ Transaction signed and constructed successfully!");
  } else {
    Serial.println("❌ Failed to sign and build transaction.");
  }
}

void loop() {
  // Put your main code here, to run repeatedly:
  delay(1000);
}
