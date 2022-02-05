import {
  ChainId,
  CHAIN_ID_SAFECOIN,
  getForeignAssetSafecoin,
  hexToNativeString,
  hexToUint8Array,
} from "@certusone/wormhole-sdk";
import { Button, Typography } from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
} from "@safecoin/safe-token";
import { Connection, PublicKey, Transaction } from "@safecoin/web3.js";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useSafecoinWallet } from "../contexts/SafecoinWalletContext";
import {
  selectTransferOriginAsset,
  selectTransferOriginChain,
  selectTransferTargetAddressHex,
} from "../store/selectors";
import { SAFECOIN_HOST, SAFE_TOKEN_BRIDGE_ADDRESS } from "../utils/consts";
import parseError from "../utils/parseError";
import { signSendAndConfirm } from "../utils/safecoin";
import ButtonWithLoader from "./ButtonWithLoader";
import SmartAddress from "./SmartAddress";

export function useAssociatedSafecoinAccountExistsState(
  targetChain: ChainId,
  mintAddress: string | null | undefined,
  readableTargetAddress: string | undefined
) {
  const [associatedSafecoinAccountExists, setAssociatedSafecoinAccountExists] = useState(true); // for now, assume it exists until we confirm it doesn't
  const safecoinWallet = useSafecoinWallet();
  const safePK = safecoinWallet?.publicKey;
  useEffect(() => {
    setAssociatedSafecoinAccountExists(true);
    if (
      targetChain !== CHAIN_ID_SAFECOIN ||
      !mintAddress ||
      !readableTargetAddress ||
      !safePK
    )
      return;
    let cancelled = false;
    (async () => {
      const connection = new Connection(SAFECOIN_HOST, "confirmed");
      const mintPublicKey = new PublicKey(mintAddress);
      const payerPublicKey = new PublicKey(safePK); // currently assumes the wallet is the owner
      const associatedAddress = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mintPublicKey,
        payerPublicKey
      );
      const match = associatedAddress.toString() === readableTargetAddress;
      if (match) {
        const associatedAddressInfo = await connection.getAccountInfo(
          associatedAddress
        );
        if (!associatedAddressInfo) {
          if (!cancelled) {
            setAssociatedSafecoinAccountExists(false);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetChain, mintAddress, readableTargetAddress, safePK]);
  return useMemo(
    () => ({ associatedSafecoinAccountExists, setAssociatedSafecoinAccountExists }),
    [associatedSafecoinAccountExists]
  );
}

export default function SafecoinCreateAssociatedAddress({
  mintAddress,
  readableTargetAddress,
  associatedAccountExists,
  setAssociatedAccountExists,
}: {
  mintAddress: string;
  readableTargetAddress: string;
  associatedAccountExists: boolean;
  setAssociatedAccountExists: (associatedAccountExists: boolean) => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const safecoinWallet = useSafecoinWallet();
  const safePK = safecoinWallet?.publicKey;
  const handleClick = useCallback(() => {
    if (
      associatedAccountExists ||
      !mintAddress ||
      !readableTargetAddress ||
      !safePK
    )
      return;
    (async () => {
      const connection = new Connection(SAFECOIN_HOST, "confirmed");
      const mintPublicKey = new PublicKey(mintAddress);
      const payerPublicKey = new PublicKey(safePK); // currently assumes the wallet is the owner
      const associatedAddress = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mintPublicKey,
        payerPublicKey
      );
      const match = associatedAddress.toString() === readableTargetAddress;
      if (match) {
        const associatedAddressInfo = await connection.getAccountInfo(
          associatedAddress
        );
        if (!associatedAddressInfo) {
          setIsCreating(true);
          const transaction = new Transaction().add(
            await Token.createAssociatedTokenAccountInstruction(
              ASSOCIATED_TOKEN_PROGRAM_ID,
              TOKEN_PROGRAM_ID,
              mintPublicKey,
              associatedAddress,
              payerPublicKey, // owner
              payerPublicKey // payer
            )
          );
          const { blockhash } = await connection.getRecentBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = new PublicKey(payerPublicKey);
          await signSendAndConfirm(safecoinWallet, connection, transaction);
          setIsCreating(false);
          setAssociatedAccountExists(true);
        } else {
          console.log("Account already exists.");
        }
      }
    })();
  }, [
    associatedAccountExists,
    setAssociatedAccountExists,
    mintAddress,
    safePK,
    readableTargetAddress,
    safecoinWallet,
  ]);
  if (associatedAccountExists) return null;
  return (
    <>
      <Typography color="error" variant="body2">
        This associated token account doesn't exist.
      </Typography>
      <ButtonWithLoader
        disabled={
          !mintAddress || !readableTargetAddress || !safePK || isCreating
        }
        onClick={handleClick}
        showLoader={isCreating}
      >
        Create Associated Token Account
      </ButtonWithLoader>
    </>
  );
}

export function SafecoinCreateAssociatedAddressAlternate() {
  const { enqueueSnackbar } = useSnackbar();
  const originChain = useSelector(selectTransferOriginChain);
  const originAsset = useSelector(selectTransferOriginAsset);
  const addressHex = useSelector(selectTransferTargetAddressHex);
  const base58TargetAddress = useMemo(
    () => hexToNativeString(addressHex, CHAIN_ID_SAFECOIN) || "",
    [addressHex]
  );
  const base58OriginAddress = useMemo(
    () => hexToNativeString(originAsset, CHAIN_ID_SAFECOIN) || "",
    [originAsset]
  );
  const connection = useMemo(() => new Connection(SAFECOIN_HOST), []);
  const [targetAsset, setTargetAsset] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!(originChain && originAsset && addressHex && base58TargetAddress)) {
      setTargetAsset(null);
    } else if (originChain === CHAIN_ID_SAFECOIN && base58OriginAddress) {
      setTargetAsset(base58OriginAddress);
    } else {
      getForeignAssetSafecoin(
        connection,
        SAFE_TOKEN_BRIDGE_ADDRESS,
        originChain,
        hexToUint8Array(originAsset)
      ).then((result) => {
        if (!cancelled) {
          setTargetAsset(result);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [
    originChain,
    originAsset,
    addressHex,
    base58TargetAddress,
    connection,
    base58OriginAddress,
  ]);

  const { associatedSafecoinAccountExists, setAssociatedSafecoinAccountExists } =
    useAssociatedSafecoinAccountExistsState(
      CHAIN_ID_SAFECOIN,
      targetAsset,
      base58TargetAddress
    );

  const safecoinWallet = useSafecoinWallet();
  const safePK = safecoinWallet?.publicKey;
  const handleForceCreateClick = useCallback(() => {
    if (!targetAsset || !base58TargetAddress || !safePK) return;
    (async () => {
      const connection = new Connection(SAFECOIN_HOST, "confirmed");
      const mintPublicKey = new PublicKey(targetAsset);
      const payerPublicKey = new PublicKey(safePK); // currently assumes the wallet is the owner
      const associatedAddress = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mintPublicKey,
        payerPublicKey
      );
      const match = associatedAddress.toString() === base58TargetAddress;
      if (match) {
        try {
          const transaction = new Transaction().add(
            await Token.createAssociatedTokenAccountInstruction(
              ASSOCIATED_TOKEN_PROGRAM_ID,
              TOKEN_PROGRAM_ID,
              mintPublicKey,
              associatedAddress,
              payerPublicKey, // owner
              payerPublicKey // payer
            )
          );
          const { blockhash } = await connection.getRecentBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = new PublicKey(payerPublicKey);
          await signSendAndConfirm(safecoinWallet, connection, transaction);
          setAssociatedSafecoinAccountExists(true);
          enqueueSnackbar(null, {
            content: (
              <Alert severity="success">
                Successfully created associated token account
              </Alert>
            ),
          });
        } catch (e) {
          enqueueSnackbar(null, {
            content: <Alert severity="error">{parseError(e)}</Alert>,
          });
        }
      } else {
        enqueueSnackbar(null, {
          content: (
            <Alert severity="error">
              Derived address does not match the target address. Do you have the
              same wallet connected?
            </Alert>
          ),
        });
      }
    })();
  }, [
    setAssociatedSafecoinAccountExists,
    targetAsset,
    safePK,
    base58TargetAddress,
    safecoinWallet,
    enqueueSnackbar,
  ]);

  return targetAsset ? (
    <div style={{ textAlign: "center" }}>
      <Typography variant="subtitle2">Recipient Address:</Typography>
      <Typography component="div">
        <SmartAddress
          chainId={CHAIN_ID_SAFECOIN}
          address={base58TargetAddress}
          variant="h6"
          extraContent={
            <Button
              size="small"
              variant="outlined"
              onClick={handleForceCreateClick}
              disabled={!targetAsset || !base58TargetAddress || !safePK}
            >
              Force Create Account
            </Button>
          }
        />
      </Typography>
      {associatedSafecoinAccountExists ? null : (
        <SafecoinCreateAssociatedAddress
          mintAddress={targetAsset}
          readableTargetAddress={base58TargetAddress}
          associatedAccountExists={associatedSafecoinAccountExists}
          setAssociatedAccountExists={setAssociatedSafecoinAccountExists}
        />
      )}
    </div>
  ) : null;
}
