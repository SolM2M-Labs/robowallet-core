//! Zero-allocation encoders/decoders for Solana wire formats (no_std).
//! Base58 (addresses, blockhashes) and compact-u16 (shortvec) lengths.

const BASE58_ALPHABET: &[u8; 58] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/// Encodes `input` as Base58 into `output`, returning the encoded length.
/// Stack-only big-number division; supports inputs up to 64 bytes.
pub fn base58_encode(input: &[u8], output: &mut [u8]) -> Result<usize, ()> {
    if input.len() > 64 {
        return Err(());
    }

    let zeros = input.iter().take_while(|&&b| b == 0).count();

    // 64 bytes * log(256)/log(58) ~= 88 digits max
    let mut digits = [0u8; 90];
    let mut len = 0usize;

    for &byte in input.iter() {
        let mut carry = byte as u32;
        for d in digits[..len].iter_mut() {
            carry += (*d as u32) << 8;
            *d = (carry % 58) as u8;
            carry /= 58;
        }
        while carry > 0 {
            if len >= digits.len() {
                return Err(());
            }
            digits[len] = (carry % 58) as u8;
            len += 1;
            carry /= 58;
        }
    }

    // Leading zero bytes encode as '1'; digits are little-endian, reverse them out.
    let total = zeros + len;
    if output.len() < total {
        return Err(());
    }
    for out_byte in output[..zeros].iter_mut() {
        *out_byte = b'1';
    }
    for (i, &d) in digits[..len].iter().rev().enumerate() {
        output[zeros + i] = BASE58_ALPHABET[d as usize];
    }
    Ok(total)
}

/// Decodes a Base58 string into exactly `N` bytes (e.g. N=32 for pubkeys/blockhashes).
pub fn base58_decode<const N: usize>(input: &[u8], output: &mut [u8; N]) -> Result<(), ()> {
    let mut bytes = [0u8; N];
    let mut len = 0usize;

    let zeros = input.iter().take_while(|&&c| c == b'1').count();

    for &c in input.iter() {
        let mut val = match BASE58_ALPHABET.iter().position(|&a| a == c) {
            Some(v) => v as u32,
            None => return Err(()),
        };
        for b in bytes[..len].iter_mut() {
            val += (*b as u32) * 58;
            *b = (val & 0xff) as u8;
            val >>= 8;
        }
        while val > 0 {
            if len >= N {
                return Err(());
            }
            bytes[len] = (val & 0xff) as u8;
            len += 1;
            val >>= 8;
        }
    }

    if zeros + len != N {
        return Err(());
    }
    // bytes is little-endian; write big-endian with leading zeros.
    for b in output[..zeros].iter_mut() {
        *b = 0;
    }
    for (i, &b) in bytes[..len].iter().rev().enumerate() {
        output[zeros + i] = b;
    }
    Ok(())
}

/// Encodes a Solana compact-u16 (shortvec) length, returning bytes written (1-3).
pub fn encode_compact_u16(mut value: u16, out: &mut [u8]) -> Result<usize, ()> {
    let mut idx = 0;
    loop {
        if idx >= out.len() {
            return Err(());
        }
        let mut byte = (value & 0x7f) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 0x80;
        }
        out[idx] = byte;
        idx += 1;
        if value == 0 {
            return Ok(idx);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base58_roundtrip_pubkey() {
        // System program ID: 32 zero bytes <-> "11111111111111111111111111111111"
        let zeros = [0u8; 32];
        let mut encoded = [0u8; 64];
        let len = base58_encode(&zeros, &mut encoded).unwrap();
        assert_eq!(&encoded[..len], b"11111111111111111111111111111111");

        let mut decoded = [0u8; 32];
        base58_decode(&encoded[..len], &mut decoded).unwrap();
        assert_eq!(decoded, zeros);
    }

    #[test]
    fn base58_known_value() {
        // [1,2,...,32] little sanity roundtrip
        let mut input = [0u8; 32];
        for (i, b) in input.iter_mut().enumerate() {
            *b = (i + 1) as u8;
        }
        let mut encoded = [0u8; 64];
        let len = base58_encode(&input, &mut encoded).unwrap();
        let mut decoded = [0u8; 32];
        base58_decode(&encoded[..len], &mut decoded).unwrap();
        assert_eq!(decoded, input);
    }

    #[test]
    fn compact_u16_encoding() {
        let mut buf = [0u8; 3];
        assert_eq!(encode_compact_u16(0, &mut buf).unwrap(), 1);
        assert_eq!(buf[0], 0);
        assert_eq!(encode_compact_u16(5, &mut buf).unwrap(), 1);
        assert_eq!(buf[0], 5);
        assert_eq!(encode_compact_u16(0x7f, &mut buf).unwrap(), 1);
        assert_eq!(encode_compact_u16(0x80, &mut buf).unwrap(), 2);
        assert_eq!(&buf[..2], &[0x80, 0x01]);
        assert_eq!(encode_compact_u16(0x3fff, &mut buf).unwrap(), 2);
        assert_eq!(&buf[..2], &[0xff, 0x7f]);
    }
}
