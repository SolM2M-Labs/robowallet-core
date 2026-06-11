// End-to-end devnet verification of the deployed RoboWallet program.
// Tests the full session lifecycle: initialize_session -> fund vault -> execute_payment -> close_session.
// Uses a persistent owner keypair (test_owner.json) so airdropped devnet SOL survives between runs.

const {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction
} = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const PROGRAM_ID = new PublicKey("ArgvLnQ5UhqJ9Ks7JF7nycbUJNzAgwR136LqzBNCCux9");
const OWNER_KEY_FILE = path.join(__dirname, 'test_owner.json');

const DISC_INITIALIZE = Buffer.from([0x45, 0x82, 0x5c, 0xec, 0x6b, 0xe7, 0x9f, 0x81]);
const DISC_EXECUTE    = Buffer.from([0x56, 0x04, 0x07, 0x07, 0x78, 0x8b, 0xe8, 0x8b]);
const DISC_CLOSE      = Buffer.from([0x44, 0x72, 0xb2, 0x8c, 0xde, 0x26, 0xf8, 0xd3]);

function loadOrCreateOwner() {
    if (fs.existsSync(OWNER_KEY_FILE)) {
        const secret = Uint8Array.from(JSON.parse(fs.readFileSync(OWNER_KEY_FILE, 'utf8')));
        return Keypair.fromSecretKey(secret);
    }
    const kp = Keypair.generate();
    fs.writeFileSync(OWNER_KEY_FILE, JSON.stringify(Array.from(kp.secretKey)));
    return kp;
}

function u64le(n) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(n));
    return buf;
}

async function main() {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    const owner = loadOrCreateOwner();
    const device = Keypair.generate();
    const target = Keypair.generate().publicKey;

    console.log("Owner :", owner.publicKey.toBase58());
    console.log("Device:", device.publicKey.toBase58());
    console.log("Target:", target.toBase58());

    let ownerBalance = await connection.getBalance(owner.publicKey);
    console.log(`Owner balance: ${ownerBalance / LAMPORTS_PER_SOL} SOL`);

    if (ownerBalance < 0.06 * LAMPORTS_PER_SOL) {
        console.log("Requesting 0.5 SOL airdrop for owner...");
        try {
            const sig = await connection.requestAirdrop(owner.publicKey, 0.5 * LAMPORTS_PER_SOL);
            const bh = await connection.getLatestBlockhash();
            await connection.confirmTransaction({ signature: sig, ...bh });
            ownerBalance = await connection.getBalance(owner.publicKey);
            console.log(`Airdrop OK. Owner balance: ${ownerBalance / LAMPORTS_PER_SOL} SOL`);
        } catch (e) {
            console.error("AIRDROP FAILED:", e.message);
            console.error(`Send >= 0.1 devnet SOL to ${owner.publicKey.toBase58()} and re-run.`);
            process.exit(2);
        }
    }

    const [sessionPDA, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("session"), owner.publicKey.toBuffer(), device.publicKey.toBuffer()],
        PROGRAM_ID
    );
    console.log(`Session PDA: ${sessionPDA.toBase58()} (bump ${bump})`);

    // --- Step 1: initialize_session(device_key, limit=0.02 SOL) + fund vault + fund device fees ---
    const initData = Buffer.concat([DISC_INITIALIZE, device.publicKey.toBuffer(), u64le(0.02 * LAMPORTS_PER_SOL)]);
    const initIx = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: sessionPDA, isSigner: false, isWritable: true },
            { pubkey: owner.publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: initData
    });
    const fundVaultIx = SystemProgram.transfer({
        fromPubkey: owner.publicKey, toPubkey: sessionPDA, lamports: 0.03 * LAMPORTS_PER_SOL
    });
    const fundDeviceIx = SystemProgram.transfer({
        fromPubkey: owner.publicKey, toPubkey: device.publicKey, lamports: 0.005 * LAMPORTS_PER_SOL
    });

    console.log("\n[1/3] initialize_session + fund vault...");
    const sig1 = await sendAndConfirmTransaction(connection, new Transaction().add(initIx, fundVaultIx, fundDeviceIx), [owner]);
    console.log("  OK:", sig1);
    console.log("  Vault balance:", await connection.getBalance(sessionPDA) / LAMPORTS_PER_SOL, "SOL");

    // --- Step 2: execute_payment(0.01 SOL), signed by device ---
    const execIx = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: sessionPDA, isSigner: false, isWritable: true },
            { pubkey: device.publicKey, isSigner: true, isWritable: false },
            { pubkey: target, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([DISC_EXECUTE, u64le(0.01 * LAMPORTS_PER_SOL)])
    });
    const tx2 = new Transaction().add(execIx);
    tx2.feePayer = device.publicKey;

    console.log("\n[2/3] execute_payment 0.01 SOL (device-signed)...");
    try {
        const sig2 = await sendAndConfirmTransaction(connection, tx2, [device]);
        console.log("  SUCCESS:", sig2);
        console.log("  Target balance:", await connection.getBalance(target) / LAMPORTS_PER_SOL, "SOL");
        console.log("  Vault balance :", await connection.getBalance(sessionPDA) / LAMPORTS_PER_SOL, "SOL");
    } catch (e) {
        console.error("  EXECUTE_PAYMENT FAILED!");
        console.error("  ", e.message);
        if (e.logs) console.error(e.logs.join("\n  "));
    }

    // --- Step 2b: over-limit payment MUST be rejected (limit 0.02, already spent 0.01) ---
    const overIx = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: sessionPDA, isSigner: false, isWritable: true },
            { pubkey: device.publicKey, isSigner: true, isWritable: false },
            { pubkey: target, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([DISC_EXECUTE, u64le(0.015 * LAMPORTS_PER_SOL)])
    });
    const tx2b = new Transaction().add(overIx);
    tx2b.feePayer = device.publicKey;

    console.log("\n[2b/3] over-limit payment 0.015 SOL (should FAIL with SpendingLimitExceeded)...");
    try {
        await sendAndConfirmTransaction(connection, tx2b, [device]);
        console.error("  SECURITY BUG: over-limit payment was ACCEPTED!");
        process.exit(1);
    } catch (e) {
        const limited = /SpendingLimitExceeded|custom program error/.test(e.message);
        console.log(limited
            ? "  OK: rejected as expected (spending limit enforced)"
            : `  Rejected, but with unexpected error: ${e.message}`);
    }

    // --- Step 3: close_session, owner recovers rent + leftover vault funds ---
    const closeIx = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: sessionPDA, isSigner: false, isWritable: true },
            { pubkey: owner.publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: DISC_CLOSE
    });
    console.log("\n[3/3] close_session (recover rent + funds)...");
    try {
        const sig3 = await sendAndConfirmTransaction(connection, new Transaction().add(closeIx), [owner]);
        console.log("  OK:", sig3);
    } catch (e) {
        console.error("  CLOSE_SESSION FAILED:", e.message);
        if (e.logs) console.error(e.logs.join("\n  "));
    }

    console.log("\nFinal owner balance:", await connection.getBalance(owner.publicKey) / LAMPORTS_PER_SOL, "SOL");
}

main().catch(err => { console.error(err); process.exit(1); });
