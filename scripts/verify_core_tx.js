// Gold-standard validation of the no_std Rust core's transaction builder.
// Runs core/txgen to produce wire bytes, then checks them with @solana/web3.js:
//  1. address derivation matches web3.js Keypair.fromSeed
//  2. transfer tx is byte-identical to a web3.js-built transaction
//  3. execute_payment tx deserializes, signature verifies, fields decode correctly

const { execFileSync } = require('child_process');
const path = require('path');
const {
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
} = require('@solana/web3.js');
const bs58mod = require('bs58');
const bs58 = bs58mod.default || bs58mod;

const TXGEN = path.join(__dirname, '..', 'core', 'target', 'x86_64-pc-windows-msvc', 'debug', 'txgen.exe');
const PROGRAM_ID = new PublicKey("ArgvLnQ5UhqJ9Ks7JF7nycbUJNzAgwR136LqzBNCCux9");

const SEED = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)); // [1..32]
const SEED_HEX = SEED.toString('hex');
const BLOCKHASH = bs58.encode(Buffer.alloc(32, 9));

function txgen(...args) {
    return execFileSync(TXGEN, args, { encoding: 'utf8' }).trim();
}

let failures = 0;
function check(name, cond, extra) {
    console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
    if (!cond) {
        failures++;
        if (extra) console.log("      " + extra);
    }
}

function main() {
    const kp = Keypair.fromSeed(SEED);

    // --- 1. Address derivation ---
    const rustAddr = txgen('address', SEED_HEX);
    check("address matches web3.js", rustAddr === kp.publicKey.toBase58(),
        `rust=${rustAddr} js=${kp.publicKey.toBase58()}`);

    // --- 2. Transfer: byte-exact match with web3.js ---
    const receiver = Keypair.fromSeed(Buffer.alloc(32, 7)).publicKey;
    const lamports = 5000000;

    const rustTransferHex = txgen('transfer', SEED_HEX, receiver.toBase58(), String(lamports), BLOCKHASH);

    const jsTx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: receiver, lamports })
    );
    jsTx.recentBlockhash = BLOCKHASH;
    jsTx.feePayer = kp.publicKey;
    jsTx.sign(kp);
    const jsTransferHex = jsTx.serialize().toString('hex');

    check("transfer tx byte-identical to web3.js", rustTransferHex === jsTransferHex,
        `rust=${rustTransferHex}\n      js  =${jsTransferHex}`);

    // --- 3. execute_payment: deserialize + verify + decode ---
    const owner = Keypair.fromSeed(Buffer.alloc(32, 11)).publicKey;
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("session"), owner.toBuffer(), kp.publicKey.toBuffer()],
        PROGRAM_ID
    );
    const target = Keypair.fromSeed(Buffer.alloc(32, 13)).publicKey;
    const amount = 12345678;

    const rustExecHex = txgen('execute', SEED_HEX, PROGRAM_ID.toBase58(), pda.toBase58(), target.toBase58(), String(amount), BLOCKHASH);
    const decoded = Transaction.from(Buffer.from(rustExecHex, 'hex'));

    check("execute_payment signature verifies", decoded.verifySignatures());
    check("fee payer is device", decoded.feePayer.equals(kp.publicKey));

    const ix = decoded.instructions[0];
    check("program id correct", ix.programId.equals(PROGRAM_ID));
    check("account[0] = session PDA (writable)", ix.keys[0].pubkey.equals(pda) && ix.keys[0].isWritable && !ix.keys[0].isSigner);
    check("account[1] = device (signer)", ix.keys[1].pubkey.equals(kp.publicKey) && ix.keys[1].isSigner);
    check("account[2] = target (writable)", ix.keys[2].pubkey.equals(target) && ix.keys[2].isWritable);
    check("account[3] = system program", ix.keys[3].pubkey.equals(SystemProgram.programId));

    const disc = Buffer.from([0x56, 0x04, 0x07, 0x07, 0x78, 0x8b, 0xe8, 0x8b]);
    check("data = discriminator + amount LE",
        ix.data.slice(0, 8).equals(disc) && ix.data.readBigUInt64LE(8) === BigInt(amount));

    console.log(failures === 0
        ? "\nALL CHECKS PASSED — Rust core produces real, valid Solana transactions."
        : `\n${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
