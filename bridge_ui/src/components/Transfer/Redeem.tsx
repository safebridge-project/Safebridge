import {
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SAFECOIN,
  CHAIN_ID_SOLANA,
  WSAFE_ADDRESS,
  WSOL_ADDRESS,
} from "@certusone/wormhole-sdk";
import { Checkbox, FormControlLabel } from "@material-ui/core";
import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { useHandleRedeem } from "../../hooks/useHandleRedeem";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import {
  selectTransferTargetAsset,
  selectTransferTargetChain,
} from "../../store/selectors";
import { WBNB_ADDRESS, WETH_ADDRESS, WMATIC_ADDRESS } from "../../utils/consts";
import ButtonWithLoader from "../ButtonWithLoader";
import KeyAndBalance from "../KeyAndBalance";
import { SolanaCreateAssociatedAddressAlternate } from "../SolanaCreateAssociatedAddress";
import StepDescription from "../StepDescription";
import WaitingForWalletMessage from "./WaitingForWalletMessage";

function Redeem() {
  const { handleClick, handleNativeClick, disabled, showLoader } =
    useHandleRedeem();
  const targetChain = useSelector(selectTransferTargetChain);
  const targetAsset = useSelector(selectTransferTargetAsset);
  const { isReady, statusMessage } = useIsWalletReady(targetChain);
  //TODO better check, probably involving a hook & the VAA
  const isEthNative =
    targetChain === CHAIN_ID_ETH &&
    targetAsset &&
    targetAsset.toLowerCase() === WETH_ADDRESS.toLowerCase();
  const isBscNative =
    targetChain === CHAIN_ID_BSC &&
    targetAsset &&
    targetAsset.toLowerCase() === WBNB_ADDRESS.toLowerCase();
  const isPolygonNative =
    targetChain === CHAIN_ID_POLYGON &&
    targetAsset &&
    targetAsset.toLowerCase() === WMATIC_ADDRESS.toLowerCase();
  const isSafeNative =
    targetChain === CHAIN_ID_SAFECOIN &&
    targetAsset &&
    targetAsset === WSAFE_ADDRESS;
  const isSolNative =
    targetChain === CHAIN_ID_SOLANA &&
    targetAsset &&
    targetAsset === WSOL_ADDRESS;
  const isNativeEligible =
    isEthNative || isBscNative || isPolygonNative || isSafeNative || isSolNative;
  const [useNativeRedeem, setUseNativeRedeem] = useState(true);
  const toggleNativeRedeem = useCallback(() => {
    setUseNativeRedeem(!useNativeRedeem);
  }, [useNativeRedeem]);

  return (
    <>
      <StepDescription>Receive the tokens on the target chain</StepDescription>
      <KeyAndBalance chainId={targetChain} />
      {isNativeEligible && (
        <FormControlLabel
          control={
            <Checkbox
              checked={useNativeRedeem}
              onChange={toggleNativeRedeem}
              color="primary"
            />
          }
          label="Automatically unwrap to native currency"
        />
      )}
      {targetChain === CHAIN_ID_SOLANA ? (
        <SolanaCreateAssociatedAddressAlternate />
      ) : null}

      <ButtonWithLoader
        //TODO disable when the associated token account is confirmed to not exist
        disabled={!isReady || disabled}
        onClick={
          isNativeEligible && useNativeRedeem ? handleNativeClick : handleClick
        }
        showLoader={showLoader}
        error={statusMessage}
      >
        Redeem
      </ButtonWithLoader>
      <WaitingForWalletMessage />
    </>
  );
}

export default Redeem;
