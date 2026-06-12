# robowallet-sdk

TypeScript helpers for the [RoboWallet](https://github.com/SolM2M-Labs/robowallet-core)
on-chain program — **session-key vaults with on-chain spending limits** for
machine-to-machine payments on Solana.

Give a device (robot, drone, sensor) a wallet it can't be robbed of: the owner
locks a budget in a program-derived vault, the device signs its own payments,
and the program rejects anything over the limit.

```bash
npm install robowallet-sdk @solana/web3.js
```

## Quick start

```ts
import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  initializeSessionInstruction,
  executePaymentInstruction,
  closeSessionInstruction,
  deriveSessionPda,
} from 'robowallet-sdk';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const owner = Keypair.generate();   // your wallet
const device = Keypair.generate();  // the machine's key

// 1. Owner opens a vault with a 0.02 SOL spending limit
const init = initializeSessionInstruction({
  owner: owner.publicKey,
  device: device.publicKey,
  spendingLimit: 20_000_000n, // lamports
});

// 2. The device pays a recipient, signing for itself
const pay = executePaymentInstruction({
  owner: owner.publicKey,
  device: device.publicKey,
  target: recipient,
  amount: 8_000_000n,
});
// build a Transaction with `pay`, feePayer = device.publicKey, sign with `device`

// 3. Owner revokes and recovers rent + unspent funds
const close = closeSessionInstruction({ owner: owner.publicKey, device: device.publicKey });
```

A full, runnable lifecycle (initialize → fund → device payment → over-limit
rejection → close) lives in
[`scripts/verify_program.js`](https://github.com/SolM2M-Labs/robowallet-core/blob/main/scripts/verify_program.js).

## API

| Export | Description |
|---|---|
| `ROBOWALLET_PROGRAM_ID` | Deployed program (devnet) |
| `deriveSessionPda(owner, device, programId?)` | `[pda, bump]` from seeds `["session", owner, device]` |
| `initializeSessionInstruction({ owner, device, spendingLimit })` | Create a vault with an on-chain limit |
| `executePaymentInstruction({ owner, device, target, amount })` | Device-signed payment from the vault |
| `closeSessionInstruction({ owner, device })` | Revoke and recover funds |
| `decodeSessionState(data)` | Decode a `SessionState` account → `{ owner, deviceKey, spendingLimit, totalSpent, bump }` |
| `remainingBudget(state)` | `spendingLimit − totalSpent` (lamports) |
| `DISCRIMINATOR` | Raw Anchor instruction discriminators |

All amounts are lamports (`bigint` or `number`). `@solana/web3.js` is a peer
dependency.

## License

[MIT](./LICENSE) © 2026 SolM2M Labs
