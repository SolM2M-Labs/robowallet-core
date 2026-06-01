# RoboWallet Core (SolM2M)

> **Bringing the Machine Economy to Solana.** 🤖 A lightweight, `no_std` embedded SDK and smart contract framework for DePIN, Robotics, and IoT.

---

## Monorepo Repository Structure

This repository contains the complete end-to-end full stack architecture for RoboWallet:

- [**/core**](file:///d:/antilnx/robowallet/core): The core Rust SDK (strictly `no_std` for ESP32, RISC-V, and bare-metal targets). Exposes C/C++ FFI.
- [**/bindings/arduino**](file:///d:/antilnx/robowallet/bindings/arduino): Foreign Function Interface (FFI) C++ wrappers and example sketches for Arduino IDE integration.
- [**/robowallet_program**](file:///d:/antilnx/robowallet/robowallet_program): On-chain Solana smart contract (Anchor program) enforcing session keys and PDA spending limits.
- [**/robowallet-dashboard**](file:///d:/antilnx/robowallet/robowallet-dashboard): Next.js Web Dashboard with live Solana Devnet RPC syncing, vault balance tracking, and session initialization.
- [**/scripts**](file:///d:/antilnx/robowallet/scripts): Node.js mock testing scripts and device simulators.

---

## Features

- **Zero Allocations**: Pure `no_std` Rust without memory allocator overhead. Extremely fast compilation size (<150KB flash).
- **Session Keys Protocol**: Safe delegation of spending limits on-chain to protect devices from physical theft.
- **Direct RPC Streaming**: Lightweight base64 transaction serialization and JSON-RPC broadcasting over TCP socket.
- **Double-Layer Security**: Supports secure element offloading (ATECC608) or software-level Session PDA vault verification.

---

## Quick Start

### 1. Compile the Core SDK & FFI staticlib
Configure the target toolchain and compile:
```bash
cd core
rustup run stable-x86_64-pc-windows-msvc cargo build --release --target riscv32imc-unknown-none-elf
```
This produces `librobowallet_core.a` in `core/target/riscv32imc-unknown-none-elf/release/` which can be dropped into the Arduino library folder.

### 2. Run the Node.js Mock Device Simulator
Simulate keypair generation, blockhash fetching, transaction construction, signing, and Solana Devnet broadcasting:
```bash
cd scripts
npm install
node mock_device.js
```

### 3. Spin up the Dashboard locally
Run the Next.js dev server:
```bash
cd robowallet-dashboard
npm install
npm run dev
```
Open `http://localhost:3000` to monitor fleet slots, manage session limits, calculate PDA vaults, and watch live Devnet transaction logs.
