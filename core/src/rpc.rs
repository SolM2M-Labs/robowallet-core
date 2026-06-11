use serde::Serialize;
use serde_json_core::ser::to_slice;

#[derive(Serialize)]
#[allow(dead_code)]
pub struct Commitment<'a> {
    pub commitment: &'a str,
}

#[derive(Serialize)]
#[allow(dead_code)]
pub struct BlockhashRequest<'a> {
    pub jsonrpc: &'a str,
    pub id: u32,
    pub method: &'a str,
    pub params: [Commitment<'a>; 1],
}

#[derive(Serialize)]
pub struct SendTxConfig<'a> {
    pub encoding: &'a str,
    #[serde(rename = "preflightCommitment")]
    pub preflight_commitment: &'a str,
}

#[derive(Serialize)]
pub struct SendTransactionRequest<'a> {
    pub jsonrpc: &'a str,
    pub id: u32,
    pub method: &'a str,
    pub params: (&'a str, SendTxConfig<'a>),
}

/// Builds a zero-allocation JSON-RPC request for `getLatestBlockhash`.
/// The resulting JSON payload can be sent over a bare-metal TCP socket.
#[allow(dead_code)]
pub fn build_blockhash_request(buffer: &mut [u8]) -> Result<usize, ()> {
    let req = BlockhashRequest {
        jsonrpc: "2.0",
        id: 1,
        method: "getLatestBlockhash",
        params: [Commitment { commitment: "finalized" }],
    };
    to_slice(&req, buffer).map_err(|_| ())
}

/// Zero-allocation base64 encoder for bare-metal M2M transactions.
pub fn base64_encode(input: &[u8], output: &mut [u8]) -> Result<usize, ()> {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut input_idx = 0;
    let mut output_idx = 0;
    
    while input_idx < input.len() {
        let rem = input.len() - input_idx;
        if rem >= 3 {
            let b0 = input[input_idx];
            let b1 = input[input_idx + 1];
            let b2 = input[input_idx + 2];
            input_idx += 3;
            
            if output_idx + 4 > output.len() { return Err(()); }
            output[output_idx] = CHARSET[(b0 >> 2) as usize];
            output[output_idx + 1] = CHARSET[(((b0 & 3) << 4) | (b1 >> 4)) as usize];
            output[output_idx + 2] = CHARSET[(((b1 & 15) << 2) | (b2 >> 6)) as usize];
            output[output_idx + 3] = CHARSET[(b2 & 63) as usize];
            output_idx += 4;
        } else if rem == 2 {
            let b0 = input[input_idx];
            let b1 = input[input_idx + 1];
            input_idx += 2;
            
            if output_idx + 4 > output.len() { return Err(()); }
            output[output_idx] = CHARSET[(b0 >> 2) as usize];
            output[output_idx + 1] = CHARSET[(((b0 & 3) << 4) | (b1 >> 4)) as usize];
            output[output_idx + 2] = CHARSET[((b1 & 15) << 2) as usize];
            output[output_idx + 3] = b'=';
            output_idx += 4;
        } else if rem == 1 {
            let b0 = input[input_idx];
            input_idx += 1;
            
            if output_idx + 4 > output.len() { return Err(()); }
            output[output_idx] = CHARSET[(b0 >> 2) as usize];
            output[output_idx + 1] = CHARSET[((b0 & 3) << 4) as usize];
            output[output_idx + 2] = b'=';
            output[output_idx + 3] = b'=';
            output_idx += 4;
        }
    }
    Ok(output_idx)
}

/// Wraps a JSON-RPC body in a minimal HTTP/1.1 POST request so it can be sent
/// over a raw TCP socket to a Solana RPC node (or a local gateway).
pub fn build_http_post(
    host: &str,
    path: &str,
    json_body: &[u8],
    out: &mut [u8],
) -> Result<usize, ()> {
    let mut pos = 0usize;

    let push = |bytes: &[u8], out: &mut [u8], pos: &mut usize| -> Result<(), ()> {
        if *pos + bytes.len() > out.len() {
            return Err(());
        }
        out[*pos..*pos + bytes.len()].copy_from_slice(bytes);
        *pos += bytes.len();
        Ok(())
    };

    // itoa for content-length (max 5 digits is plenty for our buffers)
    let mut len_digits = [0u8; 8];
    let mut n = json_body.len();
    let mut digit_count = 0;
    if n == 0 {
        len_digits[0] = b'0';
        digit_count = 1;
    }
    while n > 0 {
        len_digits[digit_count] = b'0' + (n % 10) as u8;
        n /= 10;
        digit_count += 1;
    }
    len_digits[..digit_count].reverse();

    push(b"POST ", out, &mut pos)?;
    push(path.as_bytes(), out, &mut pos)?;
    push(b" HTTP/1.1\r\nHost: ", out, &mut pos)?;
    push(host.as_bytes(), out, &mut pos)?;
    push(b"\r\nContent-Type: application/json\r\nContent-Length: ", out, &mut pos)?;
    push(&len_digits[..digit_count], out, &mut pos)?;
    push(b"\r\nConnection: close\r\n\r\n", out, &mut pos)?;
    push(json_body, out, &mut pos)?;

    Ok(pos)
}

/// Extracts the `blockhash` Base58 string from a `getLatestBlockhash` JSON
/// response and decodes it to 32 bytes — no JSON parser needed on-device.
pub fn extract_blockhash(response: &[u8], out: &mut [u8; 32]) -> Result<(), ()> {
    const NEEDLE: &[u8] = b"\"blockhash\":\"";
    let start = response
        .windows(NEEDLE.len())
        .position(|w| w == NEEDLE)
        .ok_or(())?
        + NEEDLE.len();
    let end = start
        + response[start..]
            .iter()
            .position(|&c| c == b'"')
            .ok_or(())?;
    crate::encoding::base58_decode(&response[start..end], out)
}

/// Builds a zero-allocation JSON-RPC request for `sendTransaction`.
pub fn build_send_transaction_request(
    tx_bytes: &[u8],
    base64_buffer: &mut [u8],
    json_buffer: &mut [u8],
) -> Result<usize, ()> {
    let b64_len = base64_encode(tx_bytes, base64_buffer)?;
    let b64_str = core::str::from_utf8(&base64_buffer[..b64_len]).map_err(|_| ())?;
    
    let req = SendTransactionRequest {
        jsonrpc: "2.0",
        id: 1,
        method: "sendTransaction",
        params: (
            b64_str,
            SendTxConfig {
                encoding: "base64",
                preflight_commitment: "finalized",
            },
        ),
    };
    
    to_slice(&req, json_buffer).map_err(|_| ())
}
