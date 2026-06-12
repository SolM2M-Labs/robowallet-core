// The portable core is no_std (the riscv target has no std at all). Only the
// host tooling (tests, txgen) opts into std via the `std-tools` feature.
#![cfg_attr(not(feature = "std-tools"), no_std)]

pub mod crypto;
pub mod encoding;
pub mod transaction;
pub mod rpc;
pub mod ffi;

// Panic handler for all no_std builds (the staticlib needs one on bare metal).
#[cfg(not(feature = "std-tools"))]
use panic_halt as _;

#[cfg(feature = "esp")]
use esp_alloc as _;

#[cfg(feature = "esp")]
pub fn init_heap() {
    esp_alloc::heap_allocator!(size: 72 * 1024);
}
