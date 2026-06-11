#![no_std]
#![no_main]

mod network;

use esp_hal::{delay::Delay, main};
use esp_hal::rng::Rng;
use esp_hal::timer::timg::TimerGroup;
use robowallet_core::crypto::RoboKeypair;
use robowallet_core::rpc;
use robowallet_core::transaction::build_signed_transfer;

#[main]
fn main() -> ! {
    // Initialize 72KB heap for the bare-metal Wi-Fi driver
    robowallet_core::init_heap();
    let peripherals = esp_hal::init(esp_hal::Config::default());
    let delay = Delay::new();

    // Initialize Timer and Rng required by esp-wifi
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    let mut rng = Rng::new(peripherals.RNG);
    let init = esp_wifi::init(
        timg0.timer0,
        rng,
    ).unwrap();

    // Create Wifi Controller and Device
    let wifi = peripherals.WIFI;
    let (controller, interfaces) = esp_wifi::wifi::new(&init, wifi).unwrap();

    // Phase 2: derive the device keypair from the hardware TRNG.
    // (For a persistent device identity, store the seed in NVS/EFuse instead.)
    let mut seed = [0u8; 32];
    for chunk in seed.chunks_mut(4) {
        let word = rng.random().to_le_bytes();
        chunk.copy_from_slice(&word[..chunk.len()]);
    }
    let keypair = RoboKeypair::from_seed(&seed);

    // Phase 3: build a REAL signed Solana transfer transaction.
    // The blockhash must be fetched via getLatestBlockhash in a full flow;
    // rpc::extract_blockhash parses it straight out of the RPC response.
    let dummy_receiver = [8u8; 32];
    let dummy_blockhash = [9u8; 32];
    let transfer_amount = 5_000_000; // 0.005 SOL

    let mut tx_buffer = [0u8; 512];
    let tx_len = build_signed_transfer(
        &keypair.secret,
        &dummy_receiver,
        transfer_amount,
        &dummy_blockhash,
        &mut tx_buffer,
    ).unwrap();

    // Wrap the signed transaction in a JSON-RPC sendTransaction request
    let mut base64_buffer = [0u8; 1024];
    let mut json_buffer = [0u8; 1536];
    let request_len = rpc::build_send_transaction_request(
        &tx_buffer[..tx_len],
        &mut base64_buffer,
        &mut json_buffer,
    ).unwrap();

    // Frame it as a real HTTP POST for the RPC gateway
    let mut http_buffer = [0u8; 2048];
    let http_len = rpc::build_http_post(
        "api.devnet.solana.com",
        "/",
        &json_buffer[..request_len],
        &mut http_buffer,
    ).unwrap();

    // Broadcast the transaction over Wi-Fi
    network::connect_and_send(controller, interfaces.sta, &http_buffer[..http_len]);

    loop {
        // RoboWallet OTQ (Offline Tx Queue) Polling...
        delay.delay_millis(10000u32);
    }
}
