// Inspect on-chain history of the deployed RoboWallet program:
// fetch recent transactions and classify them by instruction discriminator
// to see which instructions have ever succeeded or failed.

const { Connection, PublicKey } = require('@solana/web3.js');

const PROGRAM_ID = new PublicKey("ArgvLnQ5UhqJ9Ks7JF7nycbUJNzAgwR136LqzBNCCux9");

const DISCRIMINATORS = {
    "45825cec6be79f81": "initialize_session",
    "56040707788be88b": "execute_payment",
    "4472b28cde26f8d3": "close_session",
};

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const sigs = await connection.getSignaturesForAddress(PROGRAM_ID, { limit: 30 });
    console.log(`Found ${sigs.length} recent transactions for program\n`);

    for (const s of sigs) {
        const tx = await connection.getTransaction(s.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });
        let label = "unknown";
        if (tx) {
            const msg = tx.transaction.message;
            const keys = msg.staticAccountKeys || msg.accountKeys;
            for (const ix of msg.compiledInstructions || msg.instructions || []) {
                const progIdx = ix.programIdIndex;
                if (keys[progIdx].toBase58() === PROGRAM_ID.toBase58()) {
                    const data = Buffer.from(ix.data);
                    const disc = data.slice(0, 8).toString('hex');
                    label = DISCRIMINATORS[disc] || `unknown disc ${disc}`;
                }
            }
        }
        const status = s.err ? "FAILED " : "SUCCESS";
        console.log(`${status} | ${label.padEnd(20)} | ${s.signature.slice(0, 20)}... | slot ${s.slot}`);
        if (s.err && label === "execute_payment" && tx && tx.meta && tx.meta.logMessages) {
            console.log("    logs:");
            for (const l of tx.meta.logMessages) console.log("      " + l);
        }
        // gentle pacing to avoid tripping the rate limit again
        await new Promise(r => setTimeout(r, 400));
    }
}

main().catch(err => { console.error(err); process.exit(1); });
