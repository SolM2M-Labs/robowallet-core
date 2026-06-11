export const ROBOWALLET_PROGRAM_ID = "896w2abQMjM5KGABmDL8uuxhCCyF2GtwAL6rGPgeJxN4";

// Set NEXT_PUBLIC_SOLANA_RPC_URL in Vercel (e.g. a Helius/QuickNode devnet endpoint)
// to avoid the public RPC's aggressive per-IP rate limits.
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
