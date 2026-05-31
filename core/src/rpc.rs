use serde::Serialize;
use serde_json_core::ser::to_slice;

#[derive(Serialize)]
struct Commitment<'a> {
    commitment: &'a str,
}

#[derive(Serialize)]
struct BlockhashRequest<'a> {
    jsonrpc: &'a str,
    id: u32,
    method: &'a str,
    params: [Commitment<'a>; 1],
}

/// Builds a zero-allocation JSON-RPC request for `getLatestBlockhash`.
/// The resulting JSON payload can be sent over a bare-metal TCP socket.
pub fn build_blockhash_request(buffer: &mut [u8]) -> Result<usize, ()> {
    let req = BlockhashRequest {
        jsonrpc: "2.0",
        id: 1,
        method: "getLatestBlockhash",
        params: [Commitment { commitment: "finalized" }],
    };
    to_slice(&req, buffer).map_err(|_| ())
}
