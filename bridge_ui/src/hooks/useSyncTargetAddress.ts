import {
  canonicalAddress,
  CHAIN_ID_SAFECOIN,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  uint8ArrayToHex,
} from "@certusone/wormhole-sdk";
import { arrayify, zeroPad } from "@ethersproject/bytes";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID as ASSOCIATED_SAFE_TOKEN_PROGRAM_ID,
  Token as SafeToken,
  TOKEN_PROGRAM_ID as SAFE_TOKEN_PROGRAM_ID,
} from "@safecoin/safe-token";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID as ASSOCIATED_SPL_TOKEN_PROGRAM_ID,
  Token as SplToken,
  TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey as SafecoinPublicKey } from "@safecoin/web3.js";
import { PublicKey as SolanaPublicKey} from "@solana/web3.js";
import { useConnectedWallet } from "@terra-money/wallet-provider";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useSafecoinWallet } from "../contexts/SafecoinWalletContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import { setTargetAddressHex as setNFTTargetAddressHex } from "../store/nftSlice";
import {
  selectNFTTargetAsset,
  selectNFTTargetChain,
  selectTransferTargetAsset,
  selectTransferTargetChain,
  selectTransferTargetParsedTokenAccount,
} from "../store/selectors";
import { setTargetAddressHex as setTransferTargetAddressHex } from "../store/transferSlice";
import { isEVMChain } from "../utils/ethereum";

function useSyncTargetAddress(shouldFire: boolean, nft?: boolean) {
  const dispatch = useDispatch();
  const targetChain = useSelector(
    nft ? selectNFTTargetChain : selectTransferTargetChain
  );
  const { signerAddress } = useEthereumProvider();
  const safecoinWallet = useSafecoinWallet();
  const safePK = safecoinWallet?.publicKey;
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const targetAsset = useSelector(
    nft ? selectNFTTargetAsset : selectTransferTargetAsset
  );
  const targetParsedTokenAccount = useSelector(
    selectTransferTargetParsedTokenAccount
  );
  const targetTokenAccountPublicKey = targetParsedTokenAccount?.publicKey;
  const terraWallet = useConnectedWallet();
  const setTargetAddressHex = nft
    ? setNFTTargetAddressHex
    : setTransferTargetAddressHex;
  useEffect(() => {
    if (shouldFire) {
      let cancelled = false;
      if (isEVMChain(targetChain) && signerAddress) {
        dispatch(
          setTargetAddressHex(
            uint8ArrayToHex(zeroPad(arrayify(signerAddress), 32))
          )
        );
      }
      // TODO: have the user explicitly select an account on safecoin
      else if (
        !nft && // only support existing, non-derived token accounts for token transfers (nft flow doesn't check balance)
        targetChain === CHAIN_ID_SAFECOIN &&
        targetTokenAccountPublicKey
      ) {
        // use the target's TokenAccount if it exists
        dispatch(
          setTargetAddressHex(
            uint8ArrayToHex(
              zeroPad(new SafecoinPublicKey(targetTokenAccountPublicKey).toBytes(), 32)
            )
          )
        );
      } else if (targetChain === CHAIN_ID_SAFECOIN && safePK && targetAsset) {
        // otherwise, use the associated token account (which we create in the case it doesn't exist)
        (async () => {
          try {
            const associatedTokenAccount =
              await SafeToken.getAssociatedTokenAddress(
                ASSOCIATED_SAFE_TOKEN_PROGRAM_ID,
                SAFE_TOKEN_PROGRAM_ID,
                new SafecoinPublicKey(targetAsset), // this might error
                safePK
              );
            if (!cancelled) {
              dispatch(
                setTargetAddressHex(
                  uint8ArrayToHex(zeroPad(associatedTokenAccount.toBytes(), 32))
                )
              );
            }
          } catch (e) {
            if (!cancelled) {
              dispatch(setTargetAddressHex(undefined));
            }
          }
        })();
      } else if (
        !nft && // only support existing, non-derived token accounts for token transfers (nft flow doesn't check balance)
        targetChain === CHAIN_ID_SOLANA &&
        targetTokenAccountPublicKey
      ) {
        // use the target's TokenAccount if it exists
        dispatch(
          setTargetAddressHex(
            uint8ArrayToHex(
              zeroPad(new SolanaPublicKey(targetTokenAccountPublicKey).toBytes(), 32)
            )
          )
        );
      } else if (targetChain === CHAIN_ID_SOLANA && solPK && targetAsset) {
        // otherwise, use the associated token account (which we create in the case it doesn't exist)
        (async () => {
          try {
            const associatedTokenAccount =
              await SplToken.getAssociatedTokenAddress(
                ASSOCIATED_SPL_TOKEN_PROGRAM_ID,
                SPL_TOKEN_PROGRAM_ID,
                new SolanaPublicKey(targetAsset), // this might error
                solPK
              );
            if (!cancelled) {
              dispatch(
                setTargetAddressHex(
                  uint8ArrayToHex(zeroPad(associatedTokenAccount.toBytes(), 32))
                )
              );
            }
          } catch (e) {
            if (!cancelled) {
              dispatch(setTargetAddressHex(undefined));
            }
          }
        })();
      } else if (
        targetChain === CHAIN_ID_TERRA &&
        terraWallet &&
        terraWallet.walletAddress
      ) {
        dispatch(
          setTargetAddressHex(
            uint8ArrayToHex(
              zeroPad(canonicalAddress(terraWallet.walletAddress), 32)
            )
          )
        );
      } else {
        dispatch(setTargetAddressHex(undefined));
      }
      return () => {
        cancelled = true;
      };
    }
  }, [
    dispatch,
    shouldFire,
    targetChain,
    signerAddress,
    safePK,
    solPK,
    targetAsset,
    targetTokenAccountPublicKey,
    terraWallet,
    nft,
    setTargetAddressHex,
  ]);
}

export default useSyncTargetAddress;
