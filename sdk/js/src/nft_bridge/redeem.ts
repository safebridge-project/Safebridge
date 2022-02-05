import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { ethers } from "ethers";
import { CHAIN_ID_SOLANA } from "..";
import { Bridge__factory } from "../ethers-contracts";
import { ixFromRustSolana } from "../solana";
import { importCoreWasm, importNftWasm } from "../solana/wasm";

export async function redeemOnEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array
) {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.completeTransfer(signedVAA);
  const receipt = await v.wait();
  return receipt;
}

export async function isNFTVAASolanaNative(signedVAA: Uint8Array) {
  const { parse_vaa } = await importCoreWasm();
  const parsedVAA = parse_vaa(signedVAA);
  const isSolanaNative =
    Buffer.from(new Uint8Array(parsedVAA.payload)).readUInt16BE(33) ===
    CHAIN_ID_SOLANA;
  return isSolanaNative;
}

export async function redeemOnSolana(
  connection: Connection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
) {
  const isSolanaNative = await isNFTVAASolanaNative(signedVAA);
  const { complete_transfer_wrapped_ix, complete_transfer_native_ix } =
    await importNftWasm();
  const ixs = [];
  if (isSolanaNative) {
    ixs.push(
      ixFromRustSolana(
        complete_transfer_native_ix(
          tokenBridgeAddress,
          bridgeAddress,
          payerAddress,
          payerAddress, //TODO: allow for a different address than payer
          signedVAA
        )
      )
    );
  } else {
    ixs.push(
      ixFromRustSolana(
        complete_transfer_wrapped_ix(
          tokenBridgeAddress,
          bridgeAddress,
          payerAddress,
          payerAddress, //TODO: allow for a different address than payer
          signedVAA
        )
      )
    );
  }
  const transaction = new Transaction().add(...ixs);
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(payerAddress);
  return transaction;
}

export async function createMetaOnSolana(
  connection: Connection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
) {
  const { complete_transfer_wrapped_meta_ix } = await importNftWasm();
  const ix = ixFromRustSolana(
    complete_transfer_wrapped_meta_ix(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      signedVAA
    )
  );
  const transaction = new Transaction().add(ix);
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(payerAddress);
  return transaction;
}
