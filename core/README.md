# robowallet_core

`no_std` Solana transaction construction and session-key vault helpers for
embedded machine-to-machine payments (ESP32, RISC-V, bare-metal).

Part of [RoboWallet](https://github.com/SolM2M-Labs/robowallet-core) — give a
device a wallet it can't be robbed of, with spending limits enforced on-chain.

## What it does

- Builds genuine Solana wire-format transactions entirely on the stack —
  header, account keys, blockhash, compiled instructions, and the Ed25519
  signature — with **zero heap allocation**.
- Output is validated byte-for-byte against `@solana/web3.js`.
- Includes Base58 / compact-u16 encoders, a `getLatestBlockhash` parser, and
  HTTP/1.1 framing for raw-TCP RPC.
- Builders for System transfers and the RoboWallet `execute_payment`
  instruction.

## Features

| Feature | Purpose |
|---|---|
| *(default)* | Portable `no_std` library — builds on any host and on crates.io |
| `esp` | ESP32-C3 firmware deps (esp-hal, esp-wifi, smoltcp); required by the `robowallet_fw` binary |
| `std-tools` | Host tooling: unit tests and the `txgen` binary (pulls in std) |

## Usage

```rust
use robowallet_core::crypto::RoboKeypair;
use robowallet_core::transaction::build_signed_transfer;

let keypair = RoboKeypair::from_seed(&seed); // seed from a hardware TRNG
let mut tx = [0u8; 512];
let len = build_signed_transfer(
    &keypair.secret,
    &receiver,          // [u8; 32]
    5_000_000,          // lamports
    &recent_blockhash,  // [u8; 32]
    &mut tx,
)?;
// tx[..len] is broadcast-ready (base64-encode and POST via sendTransaction)
```

## Building

```bash
# Portable library / Arduino staticlib (riscv32imc, no_std)
cargo build --release

# ESP32-C3 firmware binary
cargo build --release --features esp --bin robowallet_fw

# Host tests
cargo test --features std-tools --target <host-triple>
```

## License

[MIT](../LICENSE) © 2026 SolM2M Labs
