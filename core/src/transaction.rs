//! Solana Transaction Serialization Module (no_std)
//! Hand-optimized binary layout for bare-metal M2M transactions.

use ed25519_dalek::{SigningKey, Signer};

/// A lightweight, stack-allocated representation of a Solana Transfer Transaction
#[allow(dead_code)]
pub struct SolTransferTx {
    pub sender: [u8; 32],
    pub receiver: [u8; 32],
    pub amount_lamports: u64,
    pub recent_blockhash: [u8; 32],
}

impl SolTransferTx {
    pub fn new(sender: [u8; 32], receiver: [u8; 32], amount_lamports: u64, recent_blockhash: [u8; 32]) -> Self {
        Self {
            sender,
            receiver,
            amount_lamports,
            recent_blockhash,
        }
    }

    /// Serializes the transaction message into a stack buffer
    /// This bypasses heavy heap-based serializers like `bincode`
    pub fn serialize_message(&self, buffer: &mut [u8]) -> usize {
        // In a real implementation, this constructs the exact Solana Message Layout:
        // Header (3 bytes) + Account Keys + Blockhash + Instructions
        
        let mut offset = 0;
        
        // Mock Header (1 required sig, 0 readonly signed, 1 readonly unsigned)
        buffer[offset] = 1; offset += 1;
        buffer[offset] = 0; offset += 1;
        buffer[offset] = 1; offset += 1;

        // Mock Blockhash insertion
        buffer[offset..offset+32].copy_from_slice(&self.recent_blockhash);
        offset += 32;

        // Mock System Program Transfer Instruction Data (lamports as little endian)
        let lamports_bytes = self.amount_lamports.to_le_bytes();
        buffer[offset..offset+8].copy_from_slice(&lamports_bytes);
        offset += 8;

        offset
    }

    /// Signs the serialized message using the hardware or software key
    pub fn sign_and_build(&self, secret_key: &SigningKey) {
        let mut msg_buffer = [0u8; 256]; // Stack allocated buffer
        let msg_len = self.serialize_message(&mut msg_buffer);
        
        let _signature = secret_key.sign(&msg_buffer[..msg_len]);
        // In a real implementation, we would append the signature to the transaction buffer
        // For MVP, we are just demonstrating the no_std signing works!
    }
}
