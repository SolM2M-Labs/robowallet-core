//! Bare-metal Wi-Fi + TCP transport for the RoboWallet firmware (smoltcp).
//!
//! Connects to the configured access point, leases an address over DHCP and
//! then performs sequential HTTP request/response exchanges with the
//! RoboRelay gateway (`scripts/roborelay.js`), which forwards JSON-RPC to a
//! Solana RPC node over TLS.

extern crate alloc;

use alloc::string::String;
use esp_println::println;
use esp_wifi::wifi::{AuthMethod, ClientConfiguration, Configuration, WifiController, WifiDevice};
use smoltcp::iface::{Config, Interface, SocketSet, SocketStorage};
use smoltcp::socket::dhcpv4;
use smoltcp::socket::tcp;
use smoltcp::wire::{EthernetAddress, HardwareAddress, IpAddress, IpCidr, IpEndpoint};

pub struct NetConfig {
    pub ssid: &'static str,
    pub password: &'static str,
    /// LAN address of the RoboRelay gateway (HTTP -> HTTPS bridge)
    pub gateway_ip: [u8; 4],
    pub gateway_port: u16,
}

fn now() -> smoltcp::time::Instant {
    smoltcp::time::Instant::from_millis(
        esp_hal::time::Instant::now().duration_since_epoch().as_millis() as i64,
    )
}

/// Runs one HTTP exchange over a fresh TCP connection.
/// Returns the number of response bytes written into `response`.
fn http_exchange(
    interface: &mut Interface,
    device: &mut WifiDevice<'_>,
    sockets: &mut SocketSet<'_>,
    tcp_handle: smoltcp::iface::SocketHandle,
    endpoint: IpEndpoint,
    local_port: u16,
    request: &[u8],
    response: &mut [u8],
) -> Result<usize, ()> {
    let delay = esp_hal::delay::Delay::new();

    {
        let socket = sockets.get_mut::<tcp::Socket>(tcp_handle);
        let cx = interface.context();
        socket.connect(cx, endpoint, local_port).map_err(|_| ())?;
    }

    let mut sent = false;
    let mut received = 0usize;

    // ~30s budget: 3000 iterations x 10ms
    for _ in 0..3000 {
        interface.poll(now(), device, sockets);
        let socket = sockets.get_mut::<tcp::Socket>(tcp_handle);

        if !sent && socket.may_send() {
            socket.send_slice(request).map_err(|_| ())?;
            sent = true;
        }

        if socket.can_recv() {
            let n = socket
                .recv(|buf| {
                    let take = core::cmp::min(buf.len(), response.len() - received);
                    response[received..received + take].copy_from_slice(&buf[..take]);
                    (take, take)
                })
                .map_err(|_| ())?;
            received += n;
        }

        // The relay closes the connection after each response (Connection: close)
        if sent && received > 0 && !socket.is_active() {
            break;
        }

        delay.delay_millis(10);
    }

    {
        let socket = sockets.get_mut::<tcp::Socket>(tcp_handle);
        socket.abort();
    }
    interface.poll(now(), device, sockets);

    if received == 0 {
        return Err(());
    }
    Ok(received)
}

/// Connects to Wi-Fi, then performs the two-step payment flow:
/// 1. sends `first_request` (getLatestBlockhash) and hands the response to
///    `make_second_request`, which builds the signed-transaction broadcast;
/// 2. sends that second request and prints the RPC response.
pub fn execute_payment_flow(
    mut controller: WifiController<'_>,
    mut device: WifiDevice<'_>,
    config: &NetConfig,
    first_request: &[u8],
    mut make_second_request: impl FnMut(&[u8], &mut [u8]) -> Result<usize, ()>,
) -> Result<(), ()> {
    println!("Connecting to Wi-Fi SSID '{}'...", config.ssid);

    let wifi_config = Configuration::Client(ClientConfiguration {
        ssid: String::from(config.ssid),
        password: String::from(config.password),
        auth_method: AuthMethod::WPA2Personal,
        ..Default::default()
    });
    controller.set_configuration(&wifi_config).map_err(|_| ())?;
    controller.start().map_err(|_| ())?;

    let delay = esp_hal::delay::Delay::new();
    loop {
        match controller.connect() {
            Ok(_) => {
                println!("Connected to Wi-Fi AP!");
                break;
            }
            Err(e) => {
                println!("Connection failed: {:?}. Retrying in 1 second...", e);
                delay.delay_millis(1000);
            }
        }
    }

    let iface_config = Config::new(HardwareAddress::Ethernet(EthernetAddress::from_bytes(
        &device.mac_address(),
    )));
    let mut interface = Interface::new(iface_config, &mut device, now());

    let dhcp_socket = dhcpv4::Socket::new();

    let mut tcp_rx_data = [0u8; 2048];
    let mut tcp_tx_data = [0u8; 2048];
    let tcp_socket = tcp::Socket::new(
        tcp::SocketBuffer::new(&mut tcp_rx_data[..]),
        tcp::SocketBuffer::new(&mut tcp_tx_data[..]),
    );

    let mut socket_entries = [SocketStorage::EMPTY; 2];
    let mut sockets = SocketSet::new(&mut socket_entries[..]);
    let dhcp_handle = sockets.add(dhcp_socket);
    let tcp_handle = sockets.add(tcp_socket);

    println!("Requesting IP address via DHCP...");
    let mut ip_assigned = false;
    for _ in 0..1000 {
        interface.poll(now(), &mut device, &mut sockets);

        let dhcp = sockets.get_mut::<dhcpv4::Socket>(dhcp_handle);
        if let Some(dhcpv4::Event::Configured(cfg)) = dhcp.poll() {
            println!("DHCP IP Assigned: {}", cfg.address);
            interface.update_ip_addrs(|addrs| {
                addrs.clear();
                addrs.push(IpCidr::Ipv4(cfg.address)).unwrap();
            });
            if let Some(router) = cfg.router {
                interface.routes_mut().add_default_ipv4_route(router).unwrap();
            }
            ip_assigned = true;
            break;
        }
        delay.delay_millis(10);
    }
    if !ip_assigned {
        println!("Error: DHCP timeout!");
        return Err(());
    }

    let [a, b, c, d] = config.gateway_ip;
    let endpoint = IpEndpoint::new(IpAddress::v4(a, b, c, d), config.gateway_port);
    println!("Gateway endpoint: {}", endpoint);

    // --- Step 1: fetch the latest blockhash ---
    let mut response1 = [0u8; 1024];
    println!("Fetching latest blockhash...");
    let n1 = http_exchange(
        &mut interface, &mut device, &mut sockets, tcp_handle,
        endpoint, 49152, first_request, &mut response1,
    )?;
    println!("Blockhash response received ({} bytes)", n1);

    // --- Step 2: build the signed transaction against that blockhash ---
    let mut request2 = [0u8; 2048];
    let req2_len = make_second_request(&response1[..n1], &mut request2)?;

    // --- Step 3: broadcast it ---
    let mut response2 = [0u8; 1024];
    println!("Broadcasting signed transaction...");
    let n2 = http_exchange(
        &mut interface, &mut device, &mut sockets, tcp_handle,
        endpoint, 49153, &request2[..req2_len], &mut response2,
    )?;

    if let Ok(text) = core::str::from_utf8(&response2[..n2]) {
        println!("RPC response: {}", text);
    } else {
        println!("RPC response received ({} bytes, non-UTF8)", n2);
    }
    Ok(())
}
