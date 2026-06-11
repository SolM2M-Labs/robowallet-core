const {
    Connection,
    PublicKey,
    TransactionInstruction,
    Transaction,
    Keypair,
    SystemProgram,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const bs58 = require('bs58');

// The live deployed Program ID
const PROGRAM_ID = new PublicKey("ArgvLnQ5UhqJ9Ks7JF7nycbUJNzAgwR136LqzBNCCux9");

async function main() {
    console.log("🤖 RoboWallet M2M Device Simulator");
    console.log("=================================");

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    console.log("📡 Connected to Solana Devnet RPC");

    // 1. Setup simulated ESP32 Device Keypair
    // We generate a fresh keypair for this run, simulating a device firmware boot
    const deviceKeypair = Keypair.generate();
    const devicePubkey = deviceKeypair.publicKey;
    console.log(`🔑 Device (ESP32) Public Key: ${devicePubkey.toBase58()}`);

    // 2. Setup Owner Wallet (Main treasury wallet that controls the session)
    // We generate a mock owner keypair for PDA computation
    const ownerKeypair = Keypair.generate();
    const ownerPubkey = ownerKeypair.publicKey;
    console.log(`👤 Owner (Phantom) Public Key: ${ownerPubkey.toBase58()}`);

    // 3. Compute Session State PDA
    // Seeds match Anchor: [b"session", owner, device]
    const [sessionPDA, bump] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("session"),
            ownerPubkey.toBuffer(),
            devicePubkey.toBuffer()
        ],
        PROGRAM_ID
    );
    console.log(`📦 Calculated Session PDA: ${sessionPDA.toBase58()} (Bump: ${bump})`);

    // 4. Request a tiny airdrop for the device to pay transaction fees (0.01 SOL)
    console.log("💧 Requesting transaction fee funding for device...");
    try {
        const airdropSig = await connection.requestAirdrop(devicePubkey, 0.01 * LAMPORTS_PER_SOL);
        const latestBlockHash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            signature: airdropSig
        });
        console.log("✅ Fee funding complete! (0.01 Devnet SOL)");
    } catch (err) {
        console.log("⚠️ Airdrop faucet rate-limited or dry. Device has 0 SOL.");
        console.log(`👉 To run this transaction, please send 0.005 SOL to: ${devicePubkey.toBase58()} via Devnet Faucet.`);
        console.log("Proceeding to build transaction bytes to show payload...");
    }

    // 5. Build raw execute_payment transaction
    // Target receiver (e.g. smart charging pad)
    const targetReceiver = Keypair.generate().publicKey;
    const amountLamports = 5000000; // 0.005 SOL
    console.log(`🎯 Target Charging Pad Receiver: ${targetReceiver.toBase58()}`);
    console.log(`💸 Amount: ${amountLamports} lamports (0.005 SOL)`);

    // Serialize arguments:
    // - Discriminator: 8 bytes (56 04 07 07 78 8b e8 8b)
    // - Amount: u64 (8 bytes, little-endian)
    const discriminator = Buffer.from([0x56, 0x04, 0x07, 0x07, 0x78, 0x8b, 0xe8, 0x8b]);
    const amountBuf = Buffer.alloc(8);
    amountBuf.writeBigUInt64LE(BigInt(amountLamports));
    const data = Buffer.concat([discriminator, amountBuf]);

    const keys = [
        { pubkey: sessionPDA, isSigner: false, isWritable: true },
        { pubkey: devicePubkey, isSigner: true, isWritable: false },
        { pubkey: targetReceiver, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ];

    const instruction = new TransactionInstruction({
        keys,
        programId: PROGRAM_ID,
        data
    });

    const tx = new Transaction().add(instruction);
    tx.feePayer = devicePubkey;
    
    try {
        const latestBlockHash = await connection.getLatestBlockhash();
        tx.recentBlockhash = latestBlockHash.blockhash;
        
        console.log("✍️ Signing transaction...");
        tx.sign(deviceKeypair);

        // Serialize the signed transaction (This matches exactly what the hardware transmits over TCP)
        const serializedTx = tx.serialize();
        console.log("\n📦 SIGNED TRANSACTION PAYLOAD (Hex):");
        console.log(serializedTx.toString('hex'));
        console.log("---------------------------------------");

        const balance = await connection.getBalance(devicePubkey);
        if (balance > 0) {
            console.log("🚀 Broadcasting transaction to Solana Devnet...");
            const signature = await connection.sendRawTransaction(serializedTx);
            console.log(`✅ Broadcast complete! Signature: ${signature}`);
            console.log(`👉 View on Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        } else {
            console.log("❌ Cannot broadcast: Device account has 0 SOL to pay transaction fee.");
        }
    } catch (err) {
        console.error("❌ Error building or broadcasting transaction:", err.message);
    }
}

main().catch(err => {
    console.error(err);
});
