const {
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const bs58 = require('bs58');

async function main() {
    console.log("🤖 RoboWallet Test Simulator (Node.js)");
    console.log("---------------------------------------");

    // 1. Establish Connection to Solana Devnet (Simulating our rpc.rs module)
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    console.log("📡 Connected to Solana Devnet RPC");

    // 2. Generate a fresh keypair (Simulating crypto.rs)
    const sender = Keypair.generate();
    console.log(`🔑 Generated Sender Node Pubkey: ${sender.publicKey.toBase58()}`);

    // No airdrop for this simulation, we just want to see the binary hex payload!

    const receiver = Keypair.generate(); // Dummy receiver (e.g., charging pad)
    console.log(`🎯 Target Receiver Node: ${receiver.publicKey.toBase58()}`);

    // Fetch a real blockhash from Devnet so the transaction is valid
    const latestBlockHash = await connection.getLatestBlockhash();
    
    const tx = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: sender.publicKey,
            toPubkey: receiver.publicKey,
            lamports: 5000000, // 0.005 SOL
        })
    );
    tx.recentBlockhash = latestBlockHash.blockhash;
    tx.feePayer = sender.publicKey;

    console.log("🔨 Constructing and Signing Raw Transaction...");
    tx.sign(sender);
    
    // Dump the raw binary payload (This is exactly what our ESP32 C/Rust code generates!)
    const rawTxBytes = tx.serialize();
    console.log("---------------------------------------");
    console.log("📦 RAW HARDWARE PAYLOAD (Hex Dump):");
    console.log(rawTxBytes.toString('hex'));
    console.log("---------------------------------------");
    console.log("✅ Ye exact wohi hex bytes hain jo humara ESP32 Wi-Fi (rpc.rs) ke through bhejjega!");
}

main().catch(err => {
    console.error(err);
});
