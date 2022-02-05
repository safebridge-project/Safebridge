import {
  Connection as SafecoinConnection, Keypair as SafecoinKeypair,
  PublicKey as SafecoinPublicKey, Transaction as SafecoinTransaction
} from "@safecoin/web3.js";
import {
  Connection as SolanaConnection, Keypair as SolanaKeypair,
  PublicKey as SolanaPublicKey, Transaction as SolanaTransaction
} from "@solana/web3.js";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { ethers } from "ethers";
import { isNativeDenom } from "..";
import { Bridge__factory } from "../ethers-contracts";
import { getBridgeFeeIxSafecoin, ixFromRustSafecoin } from "../safecoin";
import { importTokenWasm as importTokenSafecoinWasm } from "../safecoin/wasm";
import { getBridgeFeeIxSolana, ixFromRustSolana } from "../solana";
import { importTokenWasm as importTokenSolanaWasm } from "../solana/wasm";
import { createNonce } from "../utils/createNonce";

export async function attestFromEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  tokenAddress: string
) {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.attestToken(tokenAddress, createNonce());
  const receipt = await v.wait();
  return receipt;
}

export async function attestFromTerra(
  tokenBridgeAddress: string,
  walletAddress: string,
  asset: string
) {
  const nonce = Math.round(Math.random() * 100000);
  const isNativeAsset = isNativeDenom(asset);
  return new MsgExecuteContract(walletAddress, tokenBridgeAddress, {
    create_asset_meta: {
      asset_info: isNativeAsset
        ? {
          native_token: { denom: asset },
        }
        : {
          token: {
            contract_addr: asset,
          },
        },
      nonce: nonce,
    },
  });
}

export async function attestFromSafecoin(
  connection: SafecoinConnection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  mintAddress: string
) {
  const nonce = createNonce().readUInt32LE(0);
  const transferIx = await getBridgeFeeIxSafecoin(
    connection,
    bridgeAddress,
    payerAddress
  );
  const { attest_ix } = await importTokenSafecoinWasm();
  const messageKey = SafecoinKeypair.generate();
  const ix = ixFromRustSafecoin(
    attest_ix(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      messageKey.publicKey.toString(),
      mintAddress,
      nonce
    )
  );
  const transaction = new SafecoinTransaction().add(transferIx, ix);
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new SafecoinPublicKey(payerAddress);
  transaction.partialSign(messageKey);
  return transaction;
}

export async function attestFromSolana(
  connection: SolanaConnection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  mintAddress: string
) {
  const nonce = createNonce().readUInt32LE(0);
  const transferIx = await getBridgeFeeIxSolana(
    connection,
    bridgeAddress,
    payerAddress
  );
  const { attest_ix } = await importTokenSolanaWasm();
  const messageKey = SolanaKeypair.generate();
  const ix = ixFromRustSolana(
    attest_ix(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      messageKey.publicKey.toString(),
      mintAddress,
      nonce
    )
  );
  const transaction = new SolanaTransaction().add(transferIx, ix);
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new SolanaPublicKey(payerAddress);
  transaction.partialSign(messageKey);
  return transaction;
}
