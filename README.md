<div align="center">

# RoboWallet

**Autonomous machine-to-machine payments on Solana, from $5 microcontrollers.**

A `no_std` embedded Rust SDK, an on-chain session-key program, and a fleet dashboard —
everything a robot, drone, or IoT node needs to hold an identity and pay for what it consumes.

[Live Dashboard](https://robowallet-core.vercel.app) ·
[Documentation](https://robowallet-core.vercel.app/docs) ·
[Twitter](https://x.com/RoboWallet_sdk)

`Devnet Program: ArgvLnQ5UhqJ9Ks7JF7nycbUJNzAgwR136LqzBNCCux9`

</div>

---

## Why

Machines are becoming economic actors: a drone pays a charging pad, a sensor sells its data, a robot
pays for compute. But giving a device a full wallet is dangerous — steal the device, steal the funds.

RoboWallet solves this with **on-chain session keys**:

- The **owner** creates a *session vault* (a program-derived account) bound to one device key,
  with a hard **spending limit** enforced by the Solana program itself.
- The **device** signs payments with its own key — generated on-device from the hardware TRNG,
  never leaving the chip — and can only spend within the owner-approved budget.
- The owner can **revoke** the session at any time and recover every remaining lamport.

A stolen device can never drain more than the session limit. A compromised server never sees the
device key at all.

## Architecture

```
┌─────────────────────┐   signed tx (wire format)   ┌──────────────────────┐
│ ESP32-C3 / RISC-V   │ ──────── Wi-Fi/HTTP ──────► │ Solana RPC (devnet)  │
│ robowallet_core     │                             └──────────┬───────────┘
│ (no_std Rust + FFI) │                                        │
└─────────────────────┘                                        ▼
                                                    ┌──────────────────────┐
┌─────────────────────┐   initialize / revoke      │ robowallet_program   │
│ Owner (Phantom)     │ ─────────────────────────► │ Session PDA vault    │
│ Fleet Dashboard     │ ◄──── live state/feed ──── │ + spending limits    │
└─────────────────────┘                             └──────────────────────┘
```

| Directory | What it is |
|---|---|
| [`core/`](core) | `no_std` Rust SDK: Ed25519 keys, real Solana wire-format transactions, Base58/compact-u16 encoders, JSON-RPC framing — all stack-allocated, no heap |
| [`bindings/arduino/`](bindings/arduino) | Arduino IDE library (C++ wrapper over the Rust FFI) for ESP32 boards |
| [`robowallet_program/`](robowallet_program) | Anchor program: `initialize_session`, `execute_payment` (limit-enforced), `close_session` |
| [`robowallet-dashboard/`](robowallet-dashboard) | Next.js fleet dashboard: live decoded program activity, session vault state, deposit/revoke |
| [`scripts/`](scripts) | Device simulator and end-to-end on-chain verification suites |

## How a payment works

1. **Owner** opens the [dashboard](https://robowallet-core.vercel.app/dashboard), enters the device
   public key and a spending limit, and initializes the session vault (one transaction).
2. **Owner** deposits SOL into the vault. The vault is a PDA — not the device's wallet — so the
   device never holds the funds.
3. **Device** builds and signs an `execute_payment` transaction entirely on-chip
   (`rw_build_execute_payment`), then broadcasts it over Wi-Fi as a plain HTTP POST.
4. The **program** checks the device signature, enforces `total_spent + amount <= limit`
   (overflow-safe), keeps the vault rent-exempt, and moves the lamports to the recipient.
5. Over budget? The transaction is rejected on-chain with `SpendingLimitExceeded`.

## Quick start

### Build the embedded core (ESP32-C3, riscv32imc)

```bash
cd core
cargo build --release                       # Arduino staticlib (no_std, riscv32imc)
cargo build --release --features esp --bin robowallet_fw   # ESP32-C3 firmware
```

Produces `librobowallet_core.a` for the Arduino library and the `robowallet_fw` firmware image.

### Run the test suite on your host

```bash
cd core
cargo test --features std-tools --target <your-host-triple>
```

### Verify transactions against web3.js (byte-for-byte)

```bash
cd core
cargo build --bin txgen --features std-tools --target <your-host-triple>
cd ../scripts && npm install
node verify_core_tx.js
```

This proves the embedded builder emits transactions identical to `@solana/web3.js` output,
and that `execute_payment` transactions deserialize, verify, and decode correctly.

### Verify the on-chain program (devnet)

```bash
cd scripts
SOLANA_RPC_URL=<your devnet rpc> node verify_program.js
```

Runs the full lifecycle against the deployed program: initialize → fund → device payment →
**over-limit payment (must be rejected)** → close with rent recovery.

### Run the dashboard

```bash
cd robowallet-dashboard
npm install && npm run dev
```

Set `NEXT_PUBLIC_SOLANA_RPC_URL` to a dedicated devnet RPC endpoint to avoid public rate limits.

## Security model

| Threat | Mitigation |
|---|---|
| Device theft | Vault spending limit enforced by the on-chain program, not the device |
| Key extraction | Key derived from hardware TRNG on-device; ATECC608 secure-element offload planned |
| Limit bypass | `checked_add` accounting + on-chain `require!`; verified by the negative test in `verify_program.js` |
| Stuck funds | `close_session` returns rent and remaining balance to the owner at any time |
| Vault rent loss | Payments that would drop the vault below rent exemption are rejected |

## Status

Running on **Solana devnet**. The full session lifecycle — including the spending-limit
rejection path — is exercised end-to-end by the verification suite on every release.
Mainnet deployment, secure-element integration, and SPL token support are on the roadmap.

## License

[MIT](LICENSE) © 2026 SolM2M Labs
