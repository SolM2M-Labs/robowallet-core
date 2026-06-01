extern crate alloc;

use esp_wifi::wifi::{WifiController, WifiDevice, Configuration, ClientConfiguration, AuthMethod};
use smoltcp::iface::{Interface, Config, SocketSet, SocketStorage};
use smoltcp::socket::dhcpv4;
use smoltcp::socket::tcp;
use smoltcp::wire::{HardwareAddress, EthernetAddress, IpCidr, IpAddress, IpEndpoint};
use alloc::string::String;
use esp_println::println;

pub fn connect_and_send<'a>(
    mut controller: WifiController<'a>,
    mut device: WifiDevice<'a>,
    tx_payload: &[u8],
) {
    println!("Connecting to Wi-Fi...");
    
    // Set Wi-Fi configuration (SSID & Password)
    let wifi_config = Configuration::Client(ClientConfiguration {
        ssid: String::from("RoboNet"),
        password: String::from("robowallet123"),
        auth_method: AuthMethod::WPA2Personal,
        ..Default::default()
    });
    controller.set_configuration(&wifi_config).unwrap();
    controller.start().unwrap();
    
    // Wait for connection
    loop {
        match controller.connect() {
            Ok(_) => {
                println!("Connected to Wi-Fi AP!");
                break;
            }
            Err(e) => {
                println!("Connection failed: {:?}. Retrying in 1 second...", e);
                esp_hal::delay::Delay::new().delay_millis(1000);
            }
        }
    }

    // Initialize smoltcp Interface
    let config = Config::new(HardwareAddress::Ethernet(
        EthernetAddress::from_bytes(&device.mac_address())
    ));
    
    let mut interface = Interface::new(config, &mut device, smoltcp::time::Instant::from_millis(0));

    // Create DHCP socket
    let dhcp_socket = dhcpv4::Socket::new();

    // Create TCP socket buffers
    let mut tcp_rx_data = [0u8; 1024];
    let mut tcp_tx_data = [0u8; 1024];

    let tcp_rx = tcp::SocketBuffer::new(&mut tcp_rx_data[..]);
    let tcp_tx = tcp::SocketBuffer::new(&mut tcp_tx_data[..]);
    let tcp_socket = tcp::Socket::new(tcp_rx, tcp_tx);

    // Create SocketSet entries
    let mut socket_entries = [SocketStorage::EMPTY; 2];
    let mut sockets = SocketSet::new(&mut socket_entries[..]);
    
    let dhcp_handle = sockets.add(dhcp_socket);
    let tcp_handle = sockets.add(tcp_socket);

    // DHCP IP Address leasing loop
    println!("Requesting IP address via DHCP...");
    let delay = esp_hal::delay::Delay::new();
    let mut ip_assigned = false;

    for _ in 0..1000 {
        let timestamp = smoltcp::time::Instant::from_millis(
            esp_hal::time::Instant::now().duration_since_epoch().as_millis() as i64
        );

        interface.poll(timestamp, &mut device, &mut sockets);

        // Check DHCP status
        let dhcp_socket = sockets.get_mut::<dhcpv4::Socket>(dhcp_handle);
        let event = dhcp_socket.poll();
        if let Some(dhcpv4::Event::Configured(config)) = event {
            println!("DHCP IP Assigned: {}", config.address);
            
            interface.update_ip_addrs(|addrs| {
                addrs.clear();
                addrs.push(IpCidr::Ipv4(config.address)).unwrap();
            });

            if let Some(router) = config.router {
                interface.routes_mut().add_default_ipv4_route(router).unwrap();
            }

            ip_assigned = true;
            break;
        }

        delay.delay_millis(10);
    }

    if !ip_assigned {
        println!("Error: DHCP timeout!");
        return;
    }

    // Connect to Solana JSON-RPC endpoint (unencrypted HTTP gateway on port 8899)
    let rpc_endpoint = IpEndpoint::new(IpAddress::v4(192, 168, 1, 50), 8899);
    println!("Connecting to Solana RPC Endpoint at {}...", rpc_endpoint);

    let tcp_socket = sockets.get_mut::<tcp::Socket>(tcp_handle);
    let cx = interface.context();
    tcp_socket.connect(cx, rpc_endpoint, 49152).unwrap();

    let mut sent = false;

    // TCP Poll loop
    for _ in 0..1000 {
        let timestamp = smoltcp::time::Instant::from_millis(
            esp_hal::time::Instant::now().duration_since_epoch().as_millis() as i64
        );

        interface.poll(timestamp, &mut device, &mut sockets);

        let tcp_socket = sockets.get_mut::<tcp::Socket>(tcp_handle);
        if tcp_socket.is_active() && tcp_socket.may_send() && !sent {
            println!("TCP Connected! Sending transaction payload...");
            
            // Send the raw signed Solana transaction payload
            tcp_socket.send_slice(tx_payload).unwrap();
            sent = true;
            println!("Payload successfully transmitted!");
            break;
        }

        delay.delay_millis(10);
    }

    if !sent {
        println!("Error: Failed to connect or send transaction over TCP!");
    }
}
