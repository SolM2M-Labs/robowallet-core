# RoboWallet SDK (SolM2M)

> Bringing the Machine Economy to Solana. 🤖 A lightweight, `no_std` embedded SDK for DePIN, Robotics, and IoT.

## Repository Structure

This repository is structured as a full-stack monorepo:

- `/core`: The core Rust SDK backend (strictly `no_std` for ESP32/RISC-V).
- `/web`: The frontend marketing website and documentation.
- `/bindings`: Foreign Function Interfaces (FFI) for C++ and Arduino IDE integration.

## Core Features
- **Zero Allocations:** Pure `no_std` Rust. No heap memory, no crashes. Built for ESP32.
- **Hardware Security:** Native ATECC608 secure element support.
- **DePIN Ready:** Autonomous on-chain transaction building and signing for physical devices.

## Getting Started

To build the core Rust SDK for ESP32:
```bash
cd core
cargo build --target riscv32imc-unknown-none-elf
```
