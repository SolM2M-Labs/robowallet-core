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
