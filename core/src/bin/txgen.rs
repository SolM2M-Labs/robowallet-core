//! Host-side transaction generator for validating the no_std core against
//! real Solana tooling. Prints a fully-signed wire-format transaction as hex.
//!
//! Usage:
//!   txgen transfer <seed_hex32> <receiver_base58> <lamports> <blockhash_base58>
//!   txgen execute  <seed_hex32> <program_base58> <pda_base58> <target_base58> <lamports> <blockhash_base58>
//!   txgen address  <seed_hex32>
//!   txgen flow     <seed_hex32> <receiver_base58> <lamports> <relay_host> <relay_port>
//!
//! `flow` exercises the exact firmware pipeline (blockhash request framing,
//! response parsing, on-stack signing, sendTransaction framing) over a real
//! TCP connection to a RoboRelay gateway — the same bytes an ESP32 sends.
//!
//! Build: cargo build --bin txgen --features std-tools --target <host-triple>

use std::io::{Read, Write};
use std::net::TcpStream;

use robowallet_core::crypto::RoboKeypair;
use robowallet_core::encoding::{base58_decode, base58_encode};
use robowallet_core::rpc;
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

/// One HTTP request/response over a fresh TCP connection (relay closes it).
fn tcp_exchange(host: &str, port: u16, request: &[u8]) -> Vec<u8> {
    let mut stream = TcpStream::connect((host, port)).expect("relay unreachable");
    stream.write_all(request).expect("send failed");
    let mut response = Vec::new();
    stream.read_to_end(&mut response).expect("read failed");
    response
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
        "flow" => {
            let seed = parse_seed(&args[2]);
            let receiver = parse_b58(&args[3]);
            let lamports: u64 = args[4].parse().expect("invalid lamports");
            let host = args[5].as_str();
            let port: u16 = args[6].parse().expect("invalid port");

            let kp = RoboKeypair::from_seed(&seed);
            let mut addr = [0u8; 64];
            let alen = kp.get_pubkey_string(&mut addr).unwrap();
            eprintln!("device address: {}", std::str::from_utf8(&addr[..alen]).unwrap());

            // --- Step 1: getLatestBlockhash via the relay (firmware-identical framing) ---
            let mut bh_json = [0u8; 256];
            let bh_json_len = rpc::build_blockhash_request(&mut bh_json).unwrap();
            let mut bh_http = [0u8; 512];
            let bh_http_len =
                rpc::build_http_post(host, "/", &bh_json[..bh_json_len], &mut bh_http).unwrap();

            let response1 = tcp_exchange(host, port, &bh_http[..bh_http_len]);
            let mut blockhash = [0u8; 32];
            rpc::extract_blockhash(&response1, &mut blockhash).expect("no blockhash in response");
            eprintln!("blockhash extracted; signing on-stack...");

            // --- Step 2: build + sign the transfer (no_std builder) ---
            let mut tx = [0u8; 512];
            let tx_len =
                build_signed_transfer(&kp.secret, &receiver, lamports, &blockhash, &mut tx)
                    .expect("tx build failed");

            // --- Step 3: broadcast via the relay ---
            let mut b64 = [0u8; 1024];
            let mut json = [0u8; 1536];
            let json_len =
                rpc::build_send_transaction_request(&tx[..tx_len], &mut b64, &mut json).unwrap();
            let mut http2 = [0u8; 2048];
            let http2_len =
                rpc::build_http_post(host, "/", &json[..json_len], &mut http2).unwrap();

            let response2 = tcp_exchange(host, port, &http2[..http2_len]);
            // print the JSON body (skip HTTP headers) to stdout for the caller
            let body_start = response2
                .windows(4)
                .position(|w| w == b"\r\n\r\n")
                .map(|p| p + 4)
                .unwrap_or(0);
            println!("{}", String::from_utf8_lossy(&response2[body_start..]));
        }
        other => {
            // keep base58_encode linked & exercised for size sanity
            let _ = base58_encode(&[0u8; 32], &mut [0u8; 64]);
            panic!("unknown mode '{}'. {}", other, usage);
        }
    }
}
