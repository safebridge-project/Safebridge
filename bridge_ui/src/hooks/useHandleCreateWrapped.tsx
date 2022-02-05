import {
  ChainId,
  CHAIN_ID_SAFECOIN,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  createWrappedOnEth,
  createWrappedOnSolana,
  createWrappedOnSafecoin,
  createWrappedOnTerra,
  updateWrappedOnEth,
  updateWrappedOnTerra,
  postVaaSafecoin,
  postVaaSolana
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
import useAttestSignedVAA from "./useAttestSignedVAA";
import { setCreateTx, setIsCreating } from "../store/attestSlice";
import {
  selectAttestIsCreating,
  selectAttestTargetChain,
} from "../store/selectors";
import {
  getTokenBridgeAddressForChain,
  SAFECOIN_HOST,
  SAFE_BRIDGE_ADDRESS,
  SAFE_TOKEN_BRIDGE_ADDRESS,
  SOLANA_HOST,
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
  chainId: ChainId,
  shouldUpdate: boolean
) {
  dispatch(setIsCreating(true));
  try {
    const receipt = shouldUpdate
      ? await updateWrappedOnEth(
        getTokenBridgeAddressForChain(chainId),
        signer,
        signedVAA
      )
      : await createWrappedOnEth(
        getTokenBridgeAddressForChain(chainId),
        signer,
        signedVAA
      );
    dispatch(
      setCreateTx({ id: receipt.transactionHash, block: receipt.blockNumber })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsCreating(false));
  }
}

async function safecoin(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: SafecoinWalletContextState,
  payerAddress: string, // TODO: we may not need this since we have wallet
  signedVAA: Uint8Array,
  shouldUpdate: boolean //TODO utilize
) {
  dispatch(setIsCreating(true));
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

    const transaction = await createWrappedOnSafecoin(
      connection,
      SAFE_BRIDGE_ADDRESS,
      SAFE_TOKEN_BRIDGE_ADDRESS,
      payerAddress,
      signedVAA
    );
    const txid = await signSendAndConfirmSafecoin(wallet, connection, transaction);
    // TODO: didn't want to make an info call we didn't need, can we get the block without it by modifying the above call?
    dispatch(setCreateTx({ id: txid, block: 1 }));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsCreating(false));
  }
}

async function solana(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: SolanaWalletContextState,
  payerAddress: string, // TODO: we may not need this since we have wallet
  signedVAA: Uint8Array,
  shouldUpdate: boolean //TODO utilize
) {
  dispatch(setIsCreating(true));
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
    const transaction = await createWrappedOnSolana(
      connection,
      SOL_BRIDGE_ADDRESS,
      SOL_TOKEN_BRIDGE_ADDRESS,
      payerAddress,
      signedVAA
    );
    const txid = await signSendAndConfirmSolana(wallet, connection, transaction);
    // TODO: didn't want to make an info call we didn't need, can we get the block without it by modifying the above call?
    dispatch(setCreateTx({ id: txid, block: 1 }));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsCreating(false));
  }
}

async function terra(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: ConnectedWallet,
  signedVAA: Uint8Array,
  shouldUpdate: boolean
) {
  // TODO(Victor): Fix or get rid
  // dispatch(setIsCreating(true));
  // try {
  //   const msg = shouldUpdate
  //     ? await updateWrappedOnTerra(
  //         TERRA_TOKEN_BRIDGE_ADDRESS,
  //         wallet.terraAddress,
  //         signedVAA
  //       )
  //     : await createWrappedOnTerra(
  //         TERRA_TOKEN_BRIDGE_ADDRESS,
  //         wallet.terraAddress,
  //         signedVAA
  //       );
  //   const result = await postWithFees(
  //     wallet,
  //     [msg],
  //     "Wormhole - Create Wrapped"
  //   );
  //   dispatch(
  //     setCreateTx({ id: result.result.txhash, block: result.result.height })
  //   );
  //   enqueueSnackbar(null, {
  //     content: <Alert severity="success">Transaction confirmed</Alert>,
  //   });
  // } catch (e) {
  //   enqueueSnackbar(null, {
  //     content: <Alert severity="error">{parseError(e)}</Alert>,
  //   });
  //   dispatch(setIsCreating(false));
  // }
}

export function useHandleCreateWrapped(shouldUpdate: boolean) {
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const targetChain = useSelector(selectAttestTargetChain);
  const safecoinWallet = useSafecoinWallet();
  const safePK = safecoinWallet?.publicKey;
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const signedVAA = useAttestSignedVAA();
  const isCreating = useSelector(selectAttestIsCreating);
  const { signer } = useEthereumProvider();
  const terraWallet = useConnectedWallet();
  const handleCreateClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && !!signedVAA) {
      evm(
        dispatch,
        enqueueSnackbar,
        signer,
        signedVAA,
        targetChain,
        shouldUpdate
      );
    } else if (
      targetChain === CHAIN_ID_SAFECOIN &&
      !!safecoinWallet &&
      !!safePK &&
      !!signedVAA
    ) {
      safecoin(
        dispatch,
        enqueueSnackbar,
        safecoinWallet,
        safePK.toString(),
        signedVAA,
        shouldUpdate
      );
    } else if (
      targetChain === CHAIN_ID_SOLANA &&
      !!solanaWallet &&
      !!solPK &&
      !!signedVAA
    ) {
      solana(
        dispatch,
        enqueueSnackbar,
        solanaWallet,
        solPK.toString(),
        signedVAA,
        shouldUpdate
      );
    } else if (targetChain === CHAIN_ID_TERRA && !!terraWallet && !!signedVAA) {
      terra(dispatch, enqueueSnackbar, terraWallet, signedVAA, shouldUpdate);
    } else {
      // enqueueSnackbar(
      //   "Creating wrapped tokens on this chain is not yet supported",
      //   {
      //     variant: "error",
      //   }
      // );
    }
  }, [
    dispatch,
    enqueueSnackbar,
    targetChain,
    safecoinWallet,
    safePK,
    solanaWallet,
    solPK,
    terraWallet,
    signedVAA,
    signer,
    shouldUpdate,
  ]);
  return useMemo(
    () => ({
      handleClick: handleCreateClick,
      disabled: !!isCreating,
      showLoader: !!isCreating,
    }),
    [handleCreateClick, isCreating]
  );
}
