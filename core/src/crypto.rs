use ed25519_dalek::{SigningKey, VerifyingKey};

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
    pub fn get_pubkey_string(&self, buffer: &mut [u8; 64]) -> Result<usize, ()> {
        // MVP Mock: Actual base58 conversion requires allocation or complex no_std logic.
        // For hardware RPC payload, the raw bytes are used.
        let mock_str = b"Base58PubkeyMocked";
        let len = mock_str.len();
        buffer[..len].copy_from_slice(mock_str);
        Ok(len)
    }

    pub fn print_wallet_info(&self) {
        // Logging removed for MVP
    }
}
