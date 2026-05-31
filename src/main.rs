#![no_std]
#![no_main]

mod crypto;

use esp_backtrace as _;
use esp_println::println;
use esp_hal::{clock::ClockControl, peripherals::Peripherals, prelude::*, Delay};
use crate::crypto::RoboKeypair;

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

    loop {
        println!("RoboWallet Heartbeat...");
        delay.delay_ms(10000u32);
    }
}
