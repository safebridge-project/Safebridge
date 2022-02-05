import {
  ChainId,
  CHAIN_ID_SAFECOIN,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  postVaaSafecoin,
  postVaaSolana,
  redeemAndUnwrapOnSafecoin,
  redeemAndUnwrapOnSolana,
  redeemOnEth,
  redeemOnEthNative,
  redeemOnSafecoin,
  redeemOnSolana,
  redeemOnTerra,
} from "@certusone/wormhole-sdk";
import { WalletContextState as SafecoinWalletContextState } from "@safecoin/wallet-adapter-react";
import { WalletContextState as SolanaWalletContextState } from "@solana/wallet-adapter-react";
import { Connection as SafecoinConnection } from "@safecoin/web3.js";
import { Connection as SolanaConnection } from "@solana/web3.js";
import {
  ConnectedWallet,
  useConnectedWallet,
} from "@terra-money/wallet-provider";
import { Signer } from "ethers";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useSafecoinWallet } from "../contexts/SafecoinWalletContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import useTransferSignedVAA from "./useTransferSignedVAA";
import {
  selectTransferIsRedeeming,
  selectTransferTargetChain,
} from "../store/selectors";
import { setIsRedeeming, setRedeemTx } from "../store/transferSlice";
import {
  getTokenBridgeAddressForChain,
  SAFECOIN_HOST,
  SOLANA_HOST,
  SAFE_BRIDGE_ADDRESS,
  SAFE_TOKEN_BRIDGE_ADDRESS,
  SOL_BRIDGE_ADDRESS,
  SOL_TOKEN_BRIDGE_ADDRESS,
  TERRA_TOKEN_BRIDGE_ADDRESS,
} from "../utils/consts";
import { isEVMChain } from "../utils/ethereum";
import parseError from "../utils/parseError";
import { signSendAndConfirm as signSendAndConfirmSafecoin } from "../utils/safecoin";
import { signSendAndConfirm as signSendAndConfirmSolana } from "../utils/solana";
import { Alert } from "@material-ui/lab";
import { postWithFees } from "../utils/terra";

async function evm(
  dispatch: any,
  enqueueSnackbar: any,
  signer: Signer,
  signedVAA: Uint8Array,
  isNative: boolean,
  chainId: ChainId
) {
  dispatch(setIsRedeeming(true));
  try {
    const receipt = isNative
      ? await redeemOnEthNative(
          getTokenBridgeAddressForChain(chainId),
          signer,
          signedVAA
        )
      : await redeemOnEth(
          getTokenBridgeAddressForChain(chainId),
          signer,
          signedVAA
        );
    dispatch(
      setRedeemTx({ id: receipt.transactionHash, block: receipt.blockNumber })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsRedeeming(false));
  }
}

async function safecoin(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: SafecoinWalletContextState,
  payerAddress: string, //TODO: we may not need this since we have wallet
  signedVAA: Uint8Array,
  isNative: boolean
) {
  dispatch(setIsRedeeming(true));
  try {
    if (!wallet.signTransaction) {
      throw new Error("wallet.signTransaction is undefined");
    }
    const connection = new SafecoinConnection(SAFECOIN_HOST, "confirmed");
    await postVaaSafecoin(
      connection,
      wallet.signTransaction,
      SAFE_BRIDGE_ADDRESS,
      payerAddress,
      Buffer.from(signedVAA)
    );
    // TODO: how do we retry in between these steps
    const transaction = isNative
      ? await redeemAndUnwrapOnSafecoin(
          connection,
          SAFE_BRIDGE_ADDRESS,
          SAFE_TOKEN_BRIDGE_ADDRESS,
          payerAddress,
          signedVAA
        )
      : await redeemOnSafecoin(
          connection,
          SAFE_BRIDGE_ADDRESS,
          SAFE_TOKEN_BRIDGE_ADDRESS,
          payerAddress,
          signedVAA
        );
    const txid = await signSendAndConfirmSafecoin(wallet, connection, transaction);
    // TODO: didn't want to make an info call we didn't need, can we get the block without it by modifying the above call?
    dispatch(setRedeemTx({ id: txid, block: 1 }));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsRedeeming(false));
  }
}

async function solana(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: SolanaWalletContextState,
  payerAddress: string, //TODO: we may not need this since we have wallet
  signedVAA: Uint8Array,
  isNative: boolean
) {
  dispatch(setIsRedeeming(true));
  try {
    if (!wallet.signTransaction) {
      throw new Error("wallet.signTransaction is undefined");
    }
    const connection = new SolanaConnection(SOLANA_HOST, "confirmed");
    await postVaaSolana(
      connection,
      wallet.signTransaction,
      SOL_BRIDGE_ADDRESS,
      payerAddress,
      Buffer.from(signedVAA)
    );
    // TODO: how do we retry in between these steps
    const transaction = isNative
      ? await redeemAndUnwrapOnSolana(
          connection,
          SOL_BRIDGE_ADDRESS,
          SOL_TOKEN_BRIDGE_ADDRESS,
          payerAddress,
          signedVAA
        )
      : await redeemOnSolana(
          connection,
          SOL_BRIDGE_ADDRESS,
          SOL_TOKEN_BRIDGE_ADDRESS,
          payerAddress,
          signedVAA
        );
    const txid = await signSendAndConfirmSolana(wallet, connection, transaction);
    // TODO: didn't want to make an info call we didn't need, can we get the block without it by modifying the above call?
    dispatch(setRedeemTx({ id: txid, block: 1 }));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsRedeeming(false));
  }
}

async function terra(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: ConnectedWallet,
  signedVAA: Uint8Array
) {
  // TODO(Victor): Fix or get rid
  // dispatch(setIsRedeeming(true));
  // try {
  //   const msg = await redeemOnTerra(
  //     TERRA_TOKEN_BRIDGE_ADDRESS,
  //     wallet.terraAddress,
  //     signedVAA
  //   );
  //   const result = await postWithFees(
  //     wallet,
  //     [msg],
  //     "Wormhole - Complete Transfer"
  //   );
  //   dispatch(
  //     setRedeemTx({ id: result.result.txhash, block: result.result.height })
  //   );
  //   enqueueSnackbar(null, {
  //     content: <Alert severity="success">Transaction confirmed</Alert>,
  //   });
  // } catch (e) {
  //   enqueueSnackbar(null, {
  //     content: <Alert severity="error">{parseError(e)}</Alert>,
  //   });
  //   dispatch(setIsRedeeming(false));
  // }
}

export function useHandleRedeem() {
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const targetChain = useSelector(selectTransferTargetChain);
  const safecoinWallet = useSafecoinWallet();
  const safePK = safecoinWallet?.publicKey;
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const { signer } = useEthereumProvider();
  const terraWallet = useConnectedWallet();
  const signedVAA = useTransferSignedVAA();
  const isRedeeming = useSelector(selectTransferIsRedeeming);
  const handleRedeemClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && signedVAA) {
      evm(dispatch, enqueueSnackbar, signer, signedVAA, false, targetChain);
    } else if (
      targetChain === CHAIN_ID_SAFECOIN &&
      !!safecoinWallet &&
      !!safePK &&
      signedVAA
    ) {
      safecoin(
        dispatch,
        enqueueSnackbar,
        safecoinWallet,
        safePK.toString(),
        signedVAA,
        false
      );
    } else if (
      targetChain === CHAIN_ID_SOLANA &&
      !!solanaWallet &&
      !!solPK &&
      signedVAA
    ) {
      solana(
        dispatch,
        enqueueSnackbar,
        solanaWallet,
        solPK.toString(),
        signedVAA,
        false
      );
    } else if (targetChain === CHAIN_ID_TERRA && !!terraWallet && signedVAA) {
      terra(dispatch, enqueueSnackbar, terraWallet, signedVAA);
    } else {
    }
  }, [
    dispatch,
    enqueueSnackbar,
    targetChain,
    signer,
    signedVAA,
    safecoinWallet,
    safePK,
    solanaWallet,
    solPK,
    terraWallet,
  ]);

  const handleRedeemNativeClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && signedVAA) {
      evm(dispatch, enqueueSnackbar, signer, signedVAA, true, targetChain);
    } else if (
      targetChain === CHAIN_ID_SAFECOIN &&
      !!safecoinWallet &&
      !!safePK &&
      signedVAA
    ) {
      safecoin(
        dispatch,
        enqueueSnackbar,
        safecoinWallet,
        safePK.toString(),
        signedVAA,
        true
      );
    } else if (
      targetChain === CHAIN_ID_SOLANA &&
      !!solanaWallet &&
      !!solPK &&
      signedVAA
    ) {
      solana(
        dispatch,
        enqueueSnackbar,
        solanaWallet,
        solPK.toString(),
        signedVAA,
        true
      );
    } else if (targetChain === CHAIN_ID_TERRA && !!terraWallet && signedVAA) {
      terra(dispatch, enqueueSnackbar, terraWallet, signedVAA); //TODO isNative = true
    } else {
    }
  }, [
    dispatch,
    enqueueSnackbar,
    targetChain,
    signer,
    signedVAA,
    safecoinWallet,
    safePK,
    solanaWallet,
    solPK,
    terraWallet,
  ]);

  return useMemo(
    () => ({
      handleNativeClick: handleRedeemNativeClick,
      handleClick: handleRedeemClick,
      disabled: !!isRedeeming,
      showLoader: !!isRedeeming,
    }),
    [handleRedeemClick, isRedeeming, handleRedeemNativeClick]
  );
}
