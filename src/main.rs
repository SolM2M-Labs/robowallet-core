#![no_std]
#![no_main]

mod crypto;
mod transaction;

use esp_backtrace as _;
use esp_println::println;
use esp_hal::{clock::ClockControl, peripherals::Peripherals, prelude::*, Delay};
use crate::crypto::RoboKeypair;
use crate::transaction::SolTransferTx;

#[entry]
fn main() -> ! {
    let peripherals = Peripherals::take();
    let system = peripherals.SYSTEM.split();
    
    let clocks = ClockControl::max(system.clock_control).freeze();
    let mut delay = Delay::new(&clocks);

    println!("🤖 RoboWallet SDK Core Initialized");
    println!("Architecture: ESP32-C3 (RISC-V)");
    
    // Initialize Phase 2: Cryptography & Wallet Generation
    let keypair = RoboKeypair::generate_test_keypair();
    keypair.print_wallet_info();

    // Initialize Phase 3: Transaction Construction & Signing
    // Simulating an autonomous M2M payment (e.g., Drone paying Charging Pad)
    let dummy_receiver = [8u8; 32];
    let dummy_blockhash = [9u8; 32]; // Fetched via RPC in real scenario
    let transfer_amount = 5_000_000; // 0.005 SOL
    
    let tx = SolTransferTx::new(
        *keypair.public.as_bytes(),
        dummy_receiver,
        transfer_amount,
        dummy_blockhash
    );

    tx.sign_and_build(&keypair.secret);

    loop {
        println!("RoboWallet OTQ (Offline Tx Queue) Polling...");
        delay.delay_ms(10000u32);
    }
}
