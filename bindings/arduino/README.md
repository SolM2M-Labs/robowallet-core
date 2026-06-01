# RoboWallet Arduino IDE Library

This is the C/C++ FFI binding package for using the `no_std` RoboWallet Core SDK inside Arduino IDE projects (especially targeted at ESP32 microcontrollers).

## Library Structure

To install this in the Arduino IDE, place the `arduino` folder into your Arduino libraries directory (usually `Documents/Arduino/libraries/RoboWallet`):

```text
RoboWallet/
├── library.properties
├── README.md
├── src/
│   ├── robowallet.h
│   ├── RoboWallet.h
│   ├── RoboWallet.cpp
│   └── librobowallet_core.a  <-- Compiled Rust static library goes here
└── examples/
    └── SendTransfer/
        └── SendTransfer.ino
```

## Step 1: Copy Compiled Static Library

The library uses Rust's `staticlib` compilation target to pack the cryptography and transaction builders. 

Compile the Rust core for the ESP32 RISC-V target (or your matching target architecture):
```bash
cd core
rustup run stable-x86_64-pc-windows-msvc cargo build --release --target riscv32imc-unknown-none-elf
```

Then copy the compiled static library `librobowallet_core.a` from `core/target/riscv32imc-unknown-none-elf/release/librobowallet_core.a` into `RoboWallet/src/`.

## Step 2: Usage in Arduino

Include `RoboWallet.h` and use the object-oriented API:

```cpp
#include <RoboWallet.h>

RoboWallet wallet;

void setup() {
  Serial.begin(115200);
  
  // Generate a keypair and print public key
  String address = wallet.generateTestWallet();
  Serial.print("Wallet Address: ");
  Serial.println(address);
  
  // Construct a dummy transfer
  uint8_t receiver[32] = {0}; // Add receiver bytes
  uint8_t blockhash[32] = {9}; // Add recent blockhash bytes
  uint64_t lamports = 5000000;
  
  bool success = wallet.buildAndSignTransfer(receiver, lamports, blockhash);
  if (success) {
    Serial.println("Transaction signed successfully!");
  }
}

void loop() {}
```

## Supported Architectures
- ESP32, ESP32-S2, ESP32-C3, ESP32-S3
- Any target supported by the `riscv32` / `xtensa` Rust embedded compiler toolchain.
