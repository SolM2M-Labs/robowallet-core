//! Host-side transaction generator for validating the no_std core against
//! real Solana tooling. Prints a fully-signed wire-format transaction as hex.
//!
//! Usage:
//!   txgen transfer <seed_hex32> <receiver_base58> <lamports> <blockhash_base58>
//!   txgen execute  <seed_hex32> <program_base58> <pda_base58> <target_base58> <lamports> <blockhash_base58>
//!   txgen address  <seed_hex32>
//!
//! Build: cargo run --bin txgen --no-default-features -- ...

use robowallet_core::crypto::RoboKeypair;
use robowallet_core::encoding::{base58_decode, base58_encode};
use robowallet_core::transaction::{build_execute_payment, build_signed_transfer};

fn parse_seed(hex: &str) -> [u8; 32] {
    assert_eq!(hex.len(), 64, "seed must be 32 bytes of hex");
    let mut seed = [0u8; 32];
    for (i, b) in seed.iter_mut().enumerate() {
        *b = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).expect("invalid hex");
    }
    seed
}

fn parse_b58(s: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    base58_decode(s.as_bytes(), &mut out).expect("invalid base58 (expected 32 bytes)");
    out
}

fn print_hex(bytes: &[u8]) {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    println!("{}", s);
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let usage = "usage: txgen transfer|execute|address <args...>";
    let mode = args.get(1).expect(usage).as_str();

    match mode {
        "address" => {
            let seed = parse_seed(&args[2]);
            let kp = RoboKeypair::from_seed(&seed);
            let mut buf = [0u8; 64];
            let len = kp.get_pubkey_string(&mut buf).unwrap();
            println!("{}", std::str::from_utf8(&buf[..len]).unwrap());
        }
        "transfer" => {
            let seed = parse_seed(&args[2]);
            let receiver = parse_b58(&args[3]);
            let lamports: u64 = args[4].parse().expect("invalid lamports");
            let blockhash = parse_b58(&args[5]);

            let kp = RoboKeypair::from_seed(&seed);
            let mut tx = [0u8; 512];
            let len = build_signed_transfer(&kp.secret, &receiver, lamports, &blockhash, &mut tx)
                .expect("tx build failed");
            print_hex(&tx[..len]);
        }
        "execute" => {
            let seed = parse_seed(&args[2]);
            let program = parse_b58(&args[3]);
            let pda = parse_b58(&args[4]);
            let target = parse_b58(&args[5]);
            let lamports: u64 = args[6].parse().expect("invalid lamports");
            let blockhash = parse_b58(&args[7]);

            let kp = RoboKeypair::from_seed(&seed);
            let mut tx = [0u8; 512];
            let len = build_execute_payment(
                &kp.secret, &program, &pda, &target, lamports, &blockhash, &mut tx,
            )
            .expect("tx build failed");
            print_hex(&tx[..len]);
        }
        other => {
            // keep base58_encode linked & exercised for size sanity
            let _ = base58_encode(&[0u8; 32], &mut [0u8; 64]);
            panic!("unknown mode '{}'. {}", other, usage);
        }
    }
}
