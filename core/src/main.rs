#![no_std]
#![no_main]

mod network;

use esp_hal::delay::Delay;
use esp_hal::main;
use esp_hal::rng::Rng;
use esp_hal::timer::timg::TimerGroup;
use esp_println::println;
use robowallet_core::crypto::RoboKeypair;
use robowallet_core::rpc;
use robowallet_core::transaction::build_signed_transfer;

use network::NetConfig;

// ====== Deployment configuration ======
// Run `node scripts/roborelay.js` on a machine in the same LAN; it prints the
// GATEWAY_IP to use here and forwards JSON-RPC to Solana over TLS.
const NET: NetConfig = NetConfig {
    ssid: "RoboNet",
    password: "robowallet123",
    gateway_ip: [192, 168, 1, 14],
    gateway_port: 8899,
};
const GATEWAY_HOST: &str = "192.168.1.14";

/// Demo receiver (replace with your charging pad / vendor address)
const RECEIVER: [u8; 32] = [8u8; 32];
const TRANSFER_LAMPORTS: u64 = 5_000_000; // 0.005 SOL

#[main]
fn main() -> ! {
    // Initialize 72KB heap for the bare-metal Wi-Fi driver
    robowallet_core::init_heap();
    let peripherals = esp_hal::init(esp_hal::Config::default());
    let delay = Delay::new();

    // Timer and RNG required by esp-wifi
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    let mut rng = Rng::new(peripherals.RNG);
    let init = esp_wifi::init(timg0.timer0, rng).unwrap();
    let wifi = peripherals.WIFI;
    let (controller, interfaces) = esp_wifi::wifi::new(&init, wifi).unwrap();

    // Device identity from the hardware TRNG.
    // (Persist the seed in NVS/EFuse to keep the same address across boots.)
    let mut seed = [0u8; 32];
    for chunk in seed.chunks_mut(4) {
        let word = rng.random().to_le_bytes();
        chunk.copy_from_slice(&word[..chunk.len()]);
    }
    let keypair = RoboKeypair::from_seed(&seed);

    let mut addr_buf = [0u8; 64];
    if let Ok(len) = keypair.get_pubkey_string(&mut addr_buf) {
        if let Ok(addr) = core::str::from_utf8(&addr_buf[..len]) {
            println!("Device Solana address: {}", addr);
            println!("(fund it with devnet SOL for fees before broadcasting)");
        }
    }

    // Request 1: getLatestBlockhash, framed as a real HTTP POST
    let mut bh_json = [0u8; 256];
    let bh_json_len = rpc::build_blockhash_request(&mut bh_json).unwrap();
    let mut bh_http = [0u8; 512];
    let bh_http_len =
        rpc::build_http_post(GATEWAY_HOST, "/", &bh_json[..bh_json_len], &mut bh_http).unwrap();

    // Request 2 (built once the blockhash arrives): signed transfer broadcast
    let result = network::execute_payment_flow(
        controller,
        interfaces.sta,
        &NET,
        &bh_http[..bh_http_len],
        |blockhash_response, out| {
            let mut blockhash = [0u8; 32];
            rpc::extract_blockhash(blockhash_response, &mut blockhash)?;
            println!("Blockhash decoded; signing transaction on-device...");

            let mut tx = [0u8; 512];
            let tx_len = build_signed_transfer(
                &keypair.secret,
                &RECEIVER,
                TRANSFER_LAMPORTS,
                &blockhash,
                &mut tx,
            )?;

            let mut b64 = [0u8; 1024];
            let mut json = [0u8; 1536];
            let json_len =
                rpc::build_send_transaction_request(&tx[..tx_len], &mut b64, &mut json)?;
            rpc::build_http_post(GATEWAY_HOST, "/", &json[..json_len], out)
        },
    );

    match result {
        Ok(()) => println!("Payment flow complete."),
        Err(()) => println!("Payment flow FAILED — check Wi-Fi/gateway configuration."),
    }

    loop {
        delay.delay_millis(10000u32);
    }
}
