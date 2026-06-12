"use client";

import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
// Default styles that can be overridden by your app
import "@solana/wallet-adapter-react-ui/styles.css";
import { SOLANA_RPC_URL } from "../config";

export default function AppWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const network = WalletAdapterNetwork.Devnet;
  // Use the configured (dedicated) RPC so the adapter's confirmations don't
  // hit the public devnet endpoint's rate limits.
  const endpoint = useMemo(() => SOLANA_RPC_URL, []);
  const wallets = useMemo(
    () => [
      // Manually add wallets here if needed, but Phantom is auto-detected by standard wallet adapter
    ],
    [network],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
