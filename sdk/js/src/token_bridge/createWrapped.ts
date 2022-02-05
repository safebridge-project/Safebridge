import {
  Connection as SafecoinConnection, PublicKey as SafecoinPublicKey, Transaction as SafecoinTransaction
} from "@safecoin/web3.js";
import {
  Connection as SolanaConnection, PublicKey as SolanaPublicKey, Transaction as SolanaTransaction
} from "@solana/web3.js";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { ethers } from "ethers";
import { fromUint8Array } from "js-base64";
import { Bridge__factory } from "../ethers-contracts";
import { ixFromRustSafecoin } from "../safecoin";
import { importTokenWasm as importTokenSafecoinWasm } from "../safecoin/wasm";
import { ixFromRustSolana } from "../solana";
import { importTokenWasm as importTokenSolanaWasm } from "../solana/wasm";

export async function createWrappedOnEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array
) {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.createWrapped(signedVAA);
  const receipt = await v.wait();
  return receipt;
}

export async function createWrappedOnTerra(
  tokenBridgeAddress: string,
  walletAddress: string,
  signedVAA: Uint8Array
) {
  return new MsgExecuteContract(walletAddress, tokenBridgeAddress, {
    submit_vaa: {
      data: fromUint8Array(signedVAA),
    },
  });
}

export async function createWrappedOnSafecoin(
  connection: SafecoinConnection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
) {
  const { create_wrapped_ix } = await importTokenSafecoinWasm();
  const ix = ixFromRustSafecoin(
    create_wrapped_ix(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      signedVAA
    )
  );
  const transaction = new SafecoinTransaction().add(ix);
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new SafecoinPublicKey(payerAddress);
  return transaction;
}

export async function createWrappedOnSolana(
  connection: SolanaConnection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
) {
  const { create_wrapped_ix } = await importTokenSolanaWasm();
  const ix = ixFromRustSolana(
    create_wrapped_ix(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      signedVAA
    )
  );
  const transaction = new SolanaTransaction().add(ix);
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new SolanaPublicKey(payerAddress);
  return transaction;
}
