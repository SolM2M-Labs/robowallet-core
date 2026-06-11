// RoboRelay — LAN gateway for RoboWallet devices.
//
// Embedded boards speak plain HTTP over TCP; Solana's public RPC requires
// HTTPS. RoboRelay bridges the two: run it on any machine on the same LAN
// (a laptop, Raspberry Pi, or the robot's host computer), point the device's
// GATEWAY_IP at it, and every JSON-RPC request is forwarded upstream over TLS.
//
//   SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=... node roborelay.js
//
// Options (env):
//   SOLANA_RPC_URL  upstream RPC (default: https://api.devnet.solana.com)
//   PORT            listen port (default: 8899)

const http = require('http');
const os = require('os');

const UPSTREAM = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PORT = Number(process.env.PORT || 8899);

function lanAddresses() {
    return Object.values(os.networkInterfaces())
        .flat()
        .filter((i) => i && i.family === 'IPv4' && !i.internal)
        .map((i) => i.address);
}

const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end('{"error":"POST JSON-RPC only"}');
        return;
    }

    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
        const body = Buffer.concat(chunks).toString('utf8');
        let method = '?';
        try { method = JSON.parse(body).method || '?'; } catch { /* keep '?' */ }

        try {
            const upstream = await fetch(UPSTREAM, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            const text = await upstream.text();
            // Explicit Content-Length keeps the response un-chunked — far
            // simpler for embedded clients to parse.
            res.writeHead(upstream.status, {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(text),
            });
            res.end(text);

            let summary = '';
            if (method === 'sendTransaction') {
                try {
                    const j = JSON.parse(text);
                    summary = j.result
                        ? ` -> signature ${j.result.slice(0, 16)}…`
                        : ` -> error: ${j.error && j.error.message}`;
                } catch { /* non-JSON upstream reply */ }
            }
            console.log(`[relay] ${method} ${upstream.status}${summary}`);
        } catch (e) {
            console.error(`[relay] ${method} upstream failed: ${e.message}`);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'upstream unreachable' }));
        }
    });
});

server.listen(PORT, () => {
    console.log('RoboRelay — device-to-Solana RPC gateway');
    console.log(`Upstream: ${UPSTREAM.replace(/api-key=[^&]+/, 'api-key=***')}`);
    for (const ip of lanAddresses()) {
        console.log(`Listening: http://${ip}:${PORT}  <- set this as GATEWAY_IP in firmware`);
    }
});
