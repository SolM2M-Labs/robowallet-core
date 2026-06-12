# RoboWallet Web Flasher

A browser-based firmware installer (via [ESP Web Tools](https://esphome.github.io/esp-web-tools/))
that flashes an ESP32-C3 over WebSerial — no Arduino IDE or Rust toolchain on the user's side.

> **Status: scaffold — not yet linked from the live site.** Two things must land
> first (both need a physical ESP32-C3 to validate):
>
> 1. **A flashable `firmware.bin`** — generate it from the firmware ELF (below).
> 2. **Runtime Wi-Fi provisioning.** The firmware currently has Wi-Fi SSID,
>    password and gateway IP hard-coded in `core/src/main.rs`. A web-flashed
>    binary must instead let the user set these after flashing — the standard
>    path is the [Improv Wi-Fi](https://www.improv-wifi.com/) serial protocol,
>    which ESP Web Tools supports natively. Until that's implemented, flash
>    locally with credentials edited in `main.rs`.

## Generate `firmware.bin`

```bash
cargo install espflash
cd core
cargo build --release --features esp --bin robowallet_fw
espflash save-image --chip esp32c3 \
  target/riscv32imc-unknown-none-elf/release/robowallet_fw \
  ../flasher/firmware.bin
```

Place the resulting `firmware.bin` next to `manifest.json`.

## Serve it

ESP Web Tools needs HTTPS (or `localhost`) and a Chromium-based browser:

```bash
cd flasher
python -m http.server 8000   # then open http://localhost:8000
```

For production, host this folder behind HTTPS and link it from the site.
