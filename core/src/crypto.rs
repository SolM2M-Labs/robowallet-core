//! Ed25519 keypair handling for Solana (no_std).

use ed25519_dalek::{SigningKey, VerifyingKey};

use crate::encoding::base58_encode;

/// Holds the Solana Keypair (Secret Key + Public Key)
pub struct RoboKeypair {
    pub secret: SigningKey,
    pub public: VerifyingKey,
}

impl RoboKeypair {
    /// Derives a keypair from a 32-byte seed.
    /// On hardware, feed this from the ESP32 TRNG or an ATECC608 secure element.
    pub fn from_seed(seed: &[u8; 32]) -> Self {
        let secret = SigningKey::from_bytes(seed);
        let public = VerifyingKey::from(&secret);
        Self { secret, public }
    }

    /// Deterministic keypair for tests and demos only — never fund on mainnet.
    pub fn generate_test_keypair() -> Self {
        let mut test_seed = [0u8; 32];
        for (i, b) in test_seed.iter_mut().enumerate() {
            *b = (i + 1) as u8;
        }
        Self::from_seed(&test_seed)
    }

    /// Writes the Base58 Solana address into `buffer`, returning its length (max 44).
    pub fn get_pubkey_string(&self, buffer: &mut [u8; 64]) -> Result<usize, ()> {
        base58_encode(self.public.as_bytes(), buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keypair_address_is_real_base58() {
        let kp = RoboKeypair::generate_test_keypair();
        let mut buf = [0u8; 64];
        let len = kp.get_pubkey_string(&mut buf).unwrap();
        // Solana addresses are 32-44 chars of base58
        assert!(len >= 32 && len <= 44);
        assert!(buf[..len].iter().all(|c| c.is_ascii_alphanumeric()));

        // Round-trip back to the raw pubkey
        let mut decoded = [0u8; 32];
        crate::encoding::base58_decode(&buf[..len], &mut decoded).unwrap();
        assert_eq!(&decoded, kp.public.as_bytes());
    }
}
