// no_std is enforced on device builds (the riscv target has no std at all);
// host builds (--no-default-features) get std so tests and txgen can link.
#![cfg_attr(feature = "esp", no_std)]

pub mod crypto;
pub mod encoding;
pub mod transaction;
pub mod rpc;
pub mod ffi;

#[cfg(feature = "esp")]
use esp_alloc as _;
#[cfg(feature = "esp")]
use panic_halt as _;

#[cfg(feature = "esp")]
pub fn init_heap() {
    esp_alloc::heap_allocator!(size: 72 * 1024);
}
