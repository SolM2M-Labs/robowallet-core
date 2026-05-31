use ed25519_dalek::{SigningKey, VerifyingKey};
use bs58;
use esp_println::println;

/// Holds the Solana Keypair (Secret Key + Public Key)
pub struct RoboKeypair {
    pub secret: SigningKey,
    pub public: VerifyingKey,
}

impl RoboKeypair {
    /// Generates a new dummy keypair for testing
    /// In production, this will use the ESP32 Hardware TRNG or ATECC608
    pub fn generate_test_keypair() -> Self {
        // A deterministic test seed for the MVP (Do NOT use in production!)
        let test_seed: [u8; 32] = [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
            17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
        ];
        
        let secret = SigningKey::from_bytes(&test_seed);
        let public = VerifyingKey::from(&secret);

        Self { secret, public }
    }

    /// Returns the Base58 formatted Solana Address
    pub fn get_solana_address(&self, buffer: &mut [u8; 64]) -> &str {
        let pubkey_bytes = self.public.as_bytes();
        // Base58 encode without heap allocation using a pre-allocated buffer
        let len = bs58::encode(pubkey_bytes).into(buffer).unwrap();
        
        core::str::from_utf8(&buffer[..len]).unwrap_or("ENCODING_ERROR")
    }

    pub fn print_wallet_info(&self) {
        let mut b58_buffer = [0u8; 64];
        let address = self.get_solana_address(&mut b58_buffer);
        
        println!("--------------------------------------------------");
        println!("🔐 ROBO-WALLET GENERATED");
        println!("--------------------------------------------------");
        println!("Solana Address: {}", address);
        println!("Status: Keys secured in local memory.");
        println!("--------------------------------------------------");
    }
}
