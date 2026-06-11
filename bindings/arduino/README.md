# RoboWallet Arduino Library

C++ bindings for the RoboWallet `no_std` Rust core, packaged as an Arduino IDE library
for ESP32 microcontrollers. Build and sign **real Solana transactions** on-device —
the private key never leaves the chip.

## Installation

Copy this `arduino` folder into your Arduino libraries directory
(usually `Documents/Arduino/libraries/RoboWallet`):

```text
RoboWallet/
├── library.properties
├── README.md
├── src/
│   ├── robowallet_ffi.h        <-- C FFI declarations (implemented in Rust)
│   ├── robowallet.h            <-- C++ wrapper class
│   ├── RoboWallet.cpp
│   └── librobowallet_core.a    <-- Compiled Rust static library
└── examples/
    └── SendTransfer/
        └── SendTransfer.ino
```

A prebuilt `librobowallet_core.a` for `riscv32imc` (ESP32-C3) ships with the library.
To rebuild it from source:

```bash
cd core
cargo build --release   # target riscv32imc-unknown-none-elf via .cargo/config.toml
cp target/riscv32imc-unknown-none-elf/release/librobowallet_core.a ../bindings/arduino/src/
```

## Usage

```cpp
#include <RoboWallet.h>

RoboWallet wallet;

void setup() {
  Serial.begin(115200);

  // 1. Derive the device identity from the hardware TRNG.
  //    Persist the seed in NVS/EFuse to keep the same address across boots.
  uint8_t seed[32];
  for (int i = 0; i < 32; i += 4) {
    uint32_t r = esp_random();
    memcpy(seed + i, &r, 4);
  }
  wallet.setSeed(seed);
  Serial.println(wallet.getAddress());   // Base58 Solana address

  // 2. Build a fully-signed SOL transfer (Solana wire format).
  uint8_t receiver[32]  = { /* receiver pubkey bytes */ };
  uint8_t blockhash[32] = { /* from getLatestBlockhash RPC */ };
  uint8_t tx[256];
  int32_t len = wallet.buildSignedTransfer(receiver, 5000000ULL, blockhash, tx, sizeof(tx));

  // 3. base64-encode tx[0..len] and POST it to a Solana RPC via sendTransaction.
}

void loop() {}
```

For session-vault payments (spending-limit protected), use
`wallet.buildExecutePayment(programId, sessionPda, target, amount, blockhash, tx, sizeof(tx))`.

## API

| Method | Description |
|---|---|
| `setSeed(seed32)` | Set the device's Ed25519 seed and derive its Solana address |
| `getAddress()` | Cached Base58 address |
| `buildSignedTransfer(...)` | Fully-signed System transfer; returns tx byte length |
| `buildExecutePayment(...)` | Fully-signed session-vault payment; returns tx byte length |
| `generateTestWallet()` | Deterministic test keypair (demos only — never fund it) |

All builders return the transaction length on success or a negative error code
(`-1` bad argument, `-2` buffer too small, `-3` serialization failure).

## Supported targets

- ESP32-C3 (riscv32imc) — prebuilt library included
- Any RISC-V / Xtensa target supported by the Rust embedded toolchain (rebuild the `.a`)
