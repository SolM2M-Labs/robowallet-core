#![no_std]
#![no_main]

mod network;

use esp_hal::{delay::Delay, main};
use esp_hal::rng::Rng;
use esp_hal::timer::timg::TimerGroup;
use ed25519_dalek::Signer;
use robowallet_core::crypto::RoboKeypair;
use robowallet_core::transaction::SolTransferTx;
use robowallet_core::rpc;

#[main]
fn main() -> ! {
    // Initialize 72KB heap for the bare-metal Wi-Fi driver
    robowallet_core::init_heap();
    let peripherals = esp_hal::init(esp_hal::Config::default());
    let delay = Delay::new();

    // Initialize Timer and Rng required by esp-wifi
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    let rng = Rng::new(peripherals.RNG);
    let init = esp_wifi::init(
        timg0.timer0,
        rng,
    ).unwrap();

    // Create Wifi Controller and Device
    let wifi = peripherals.WIFI;
    let (controller, interfaces) = esp_wifi::wifi::new(&init, wifi).unwrap();

    // Initialize Phase 2: Cryptography & Wallet Generation
    let keypair = RoboKeypair::generate_test_keypair();
    keypair.print_wallet_info();

    // Initialize Phase 3: Transaction Construction & Signing
    let dummy_receiver = [8u8; 32];
    let dummy_blockhash = [9u8; 32]; // Fetched via RPC in real scenario
    let transfer_amount = 5_000_000; // 0.005 SOL
    
    let tx = SolTransferTx::new(
        *keypair.public.as_bytes(),
        dummy_receiver,
        transfer_amount,
        dummy_blockhash
    );

    // Build the serialized message buffer
    let mut tx_msg_buffer = [0u8; 256];
    let msg_len = tx.serialize_message(&mut tx_msg_buffer);

    // Sign the transaction message using software key
    let _signature = keypair.secret.sign(&tx_msg_buffer[..msg_len]);
    
    // In a production layout, we append signature and header to form the final Solana Tx.
    // For M2M demo, we format this payload into a JSON-RPC broadcast request
    let mut base64_buffer = [0u8; 512];
    let mut json_buffer = [0u8; 1024];
    
    let request_len = rpc::build_send_transaction_request(
        &tx_msg_buffer[..msg_len],
        &mut base64_buffer,
        &mut json_buffer,
    ).unwrap();

    // Broadcast the transaction over Wi-Fi
    network::connect_and_send(controller, interfaces.sta, &json_buffer[..request_len]);

    loop {
        // RoboWallet OTQ (Offline Tx Queue) Polling...
        delay.delay_millis(10000u32);
    }
}
