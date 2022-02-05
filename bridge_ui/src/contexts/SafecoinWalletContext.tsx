import { WalletDialogProvider } from "@safecoin/wallet-adapter-material-ui";
import { useWallet, WalletProvider } from "@safecoin/wallet-adapter-react";
import {
  // getPhantomWallet,
  getSafecoinWallet,
  // getSolflareWallet,
  // getSolletWallet,
  // getMathWallet
} from "@safecoin/wallet-adapter-wallets";
import React, { FC, useMemo } from "react";

export const SafecoinWalletProvider: FC = (props) => {
  // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking --
  // Only the wallets you want to instantiate here will be compiled into your application
  const wallets = useMemo(() => {
    return [
      // getPhantomWallet(),
      // getSolflareWallet(),
      // getTorusWallet({
      //     options: { clientId: 'Go to https://developer.tor.us and create a client ID' }
      // }),
      // getLedgerWallet(),
      getSafecoinWallet(),
      // getMathWallet(),
      // getSolletWallet(),
    ];
  }, []);

  return (
    <WalletProvider wallets={wallets}>
      <WalletDialogProvider>{props.children}</WalletDialogProvider>
    </WalletProvider>
  );
};

export const useSafecoinWallet = useWallet;
