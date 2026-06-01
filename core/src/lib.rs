#![no_std]

extern crate alloc;

pub mod crypto;
pub mod transaction;
pub mod rpc;
pub mod ffi;

use esp_alloc as _;
use panic_halt as _;

pub fn init_heap() {
    esp_alloc::heap_allocator!(size: 72 * 1024);
}
