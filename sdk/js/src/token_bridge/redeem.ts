import {
  AccountLayout as SafeAccountLayout,
  Token as SafeToken,
  TOKEN_PROGRAM_ID as SAFE_TOKEN_PROGRAM_ID,
  u64 as Safeu64 
} from "@safecoin/safe-token";
import {
  AccountLayout as SplAccountLayout,
  Token as SplToken,
  TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID,
  u64 as Splu64 
} from "@solana/spl-token";
import {
  Connection as SafecoinConnection,
  Keypair as SafecoinKeypair,
  PublicKey as SafecoinPublicKey,
  SystemProgram as SafecoinSystemProgram,
  Transaction as SafecoinTransaction,
} from "@safecoin/web3.js";
import {
  Connection as SolanaConnection,
  Keypair as SolanaKeypair,
  PublicKey as SolanaPublicKey,
  SystemProgram as SolanaSystemProgram,
  Transaction as SolanaTransaction,
} from "@solana/web3.js";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { ethers } from "ethers";
import { fromUint8Array } from "js-base64";
import { Bridge__factory } from "../ethers-contracts";
import { ixFromRustSafecoin } from "../safecoin";
import { ixFromRustSolana } from "../solana";
import {
  importCoreWasm as importCoreSafecoinWasm,
  importTokenWasm as importTokenSafecoinWasm
} from "../safecoin/wasm";
import {
  importCoreWasm as importCoreSolanaWasm,
  importTokenWasm as importTokenSolanaWasm
} from "../solana/wasm";
import {
  CHAIN_ID_SAFECOIN,
  CHAIN_ID_SOLANA,
  WSAFE_ADDRESS,
  WSAFE_DECIMALS,
  WSOL_ADDRESS,
  WSOL_DECIMALS,
  MAX_VAA_DECIMALS,
} from "../utils";
import { hexToNativeString } from "../utils/array";
import { parseTransferPayload } from "../utils/parseVaa";

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

export async function redeemOnEthNative(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array
) {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.completeTransferAndUnwrapETH(signedVAA);
  const receipt = await v.wait();
  return receipt;
}

export async function redeemOnTerra(
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

export async function redeemAndUnwrapOnSafecoin(
  connection: SafecoinConnection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
) {
  const { parse_vaa } = await importCoreSafecoinWasm();
  const { complete_transfer_native_ix } = await importTokenSafecoinWasm();
  const parsedVAA = parse_vaa(signedVAA);
  const parsedPayload = parseTransferPayload(
    Buffer.from(new Uint8Array(parsedVAA.payload))
  );
  const targetAddress = hexToNativeString(
    parsedPayload.targetAddress,
    CHAIN_ID_SAFECOIN
  );
  if (!targetAddress) {
    throw new Error("Failed to read the target address.");
  }
  const targetPublicKey = new SafecoinPublicKey(targetAddress);
  const targetAmount =
    parsedPayload.amount *
    BigInt(WSAFE_DECIMALS - MAX_VAA_DECIMALS) *
    BigInt(10);
  const rentBalance = await SafeToken.getMinBalanceRentForExemptAccount(connection);
  const mintPublicKey = new SafecoinPublicKey(WSAFE_ADDRESS);
  const payerPublicKey = new SafecoinPublicKey(payerAddress);
  const ancillaryKeypair = SafecoinKeypair.generate();

  const completeTransferIx = ixFromRustSafecoin(
    complete_transfer_native_ix(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      signedVAA
    )
  );

  //This will create a temporary account where the wSAFE will be moved
  const createAncillaryAccountIx = SafecoinSystemProgram.createAccount({
    fromPubkey: payerPublicKey,
    newAccountPubkey: ancillaryKeypair.publicKey,
    lamports: rentBalance, //safe token accounts need rent exemption
    space: SafeAccountLayout.span,
    programId: SAFE_TOKEN_PROGRAM_ID,
  });

  //Initialize the account as a WSAFE account, with the original payerAddress as owner
  const initAccountIx = await SafeToken.createInitAccountInstruction(
    SAFE_TOKEN_PROGRAM_ID,
    mintPublicKey,
    ancillaryKeypair.publicKey,
    payerPublicKey
  );

  //Send in the amount of wSAFE which we want converted to SAFE
  const balanceTransferIx = SafeToken.createTransferInstruction(
    SAFE_TOKEN_PROGRAM_ID,
    targetPublicKey,
    ancillaryKeypair.publicKey,
    payerPublicKey,
    [],
    new Safeu64(targetAmount.toString(16), 16)
  );

  //Close the ancillary account for cleanup. Payer address receives any remaining funds
  const closeAccountIx = SafeToken.createCloseAccountInstruction(
    SAFE_TOKEN_PROGRAM_ID,
    ancillaryKeypair.publicKey, //account to close
    payerPublicKey, //Remaining funds destination
    payerPublicKey, //authority
    []
  );

  const { blockhash } = await connection.getRecentBlockhash();
  const transaction = new SafecoinTransaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new SafecoinPublicKey(payerAddress);
  transaction.add(completeTransferIx);
  transaction.add(createAncillaryAccountIx);
  transaction.add(initAccountIx);
  transaction.add(balanceTransferIx);
  transaction.add(closeAccountIx);
  transaction.partialSign(ancillaryKeypair);
  return transaction;
}

export async function redeemOnSafecoin(
  connection: SafecoinConnection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
) {
  const { parse_vaa } = await importCoreSafecoinWasm();
  const parsedVAA = parse_vaa(signedVAA);
  const isSafecoinNative =
    Buffer.from(new Uint8Array(parsedVAA.payload)).readUInt16BE(65) ===
    CHAIN_ID_SAFECOIN;
  const { complete_transfer_wrapped_ix, complete_transfer_native_ix } =
    await importTokenSafecoinWasm();
  const ixs = [];
  if (isSafecoinNative) {
    ixs.push(
      ixFromRustSafecoin(
        complete_transfer_native_ix(
          tokenBridgeAddress,
          bridgeAddress,
          payerAddress,
          signedVAA
        )
      )
    );
  } else {
    ixs.push(
      ixFromRustSafecoin(
        complete_transfer_wrapped_ix(
          tokenBridgeAddress,
          bridgeAddress,
          payerAddress,
          signedVAA
        )
      )
    );
  }
  const transaction = new SafecoinTransaction().add(...ixs);
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new SafecoinPublicKey(payerAddress);
  return transaction;
}

export async function redeemAndUnwrapOnSolana(
  connection: SolanaConnection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
) {
  const { parse_vaa } = await importCoreSolanaWasm();
  const { complete_transfer_native_ix } = await importTokenSolanaWasm();
  const parsedVAA = parse_vaa(signedVAA);
  const parsedPayload = parseTransferPayload(
    Buffer.from(new Uint8Array(parsedVAA.payload))
  );
  const targetAddress = hexToNativeString(
    parsedPayload.targetAddress,
    CHAIN_ID_SOLANA
  );
  if (!targetAddress) {
    throw new Error("Failed to read the target address.");
  }
  const targetPublicKey = new SolanaPublicKey(targetAddress);
  const targetAmount =
    parsedPayload.amount *
    BigInt(WSOL_DECIMALS - MAX_VAA_DECIMALS) *
    BigInt(10);
  const rentBalance = await SplToken.getMinBalanceRentForExemptAccount(connection);
  const mintPublicKey = new SolanaPublicKey(WSOL_ADDRESS);
  const payerPublicKey = new SolanaPublicKey(payerAddress);
  const ancillaryKeypair = SolanaKeypair.generate();

  const completeTransferIx = ixFromRustSolana(
    complete_transfer_native_ix(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      signedVAA
    )
  );

  //This will create a temporary account where the wSOL will be moved
  const createAncillaryAccountIx = SolanaSystemProgram.createAccount({
    fromPubkey: payerPublicKey,
    newAccountPubkey: ancillaryKeypair.publicKey,
    lamports: rentBalance, //spl token accounts need rent exemption
    space: SplAccountLayout.span,
    programId: SPL_TOKEN_PROGRAM_ID,
  });

  //Initialize the account as a WSOL account, with the original payerAddress as owner
  const initAccountIx = await SplToken.createInitAccountInstruction(
    SPL_TOKEN_PROGRAM_ID,
    mintPublicKey,
    ancillaryKeypair.publicKey,
    payerPublicKey
  );

  //Send in the amount of wSOL which we want converted to SOL
  const balanceTransferIx = SplToken.createTransferInstruction(
    SPL_TOKEN_PROGRAM_ID,
    targetPublicKey,
    ancillaryKeypair.publicKey,
    payerPublicKey,
    [],
    new Splu64(targetAmount.toString(16), 16)
  );

  //Close the ancillary account for cleanup. Payer address receives any remaining funds
  const closeAccountIx = SplToken.createCloseAccountInstruction(
    SPL_TOKEN_PROGRAM_ID,
    ancillaryKeypair.publicKey, //account to close
    payerPublicKey, //Remaining funds destination
    payerPublicKey, //authority
    []
  );

  const { blockhash } = await connection.getRecentBlockhash();
  const transaction = new SolanaTransaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new SolanaPublicKey(payerAddress);
  transaction.add(completeTransferIx);
  transaction.add(createAncillaryAccountIx);
  transaction.add(initAccountIx);
  transaction.add(balanceTransferIx);
  transaction.add(closeAccountIx);
  transaction.partialSign(ancillaryKeypair);
  return transaction;
}

export async function redeemOnSolana(
  connection: SolanaConnection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
) {
  const { parse_vaa } = await importCoreSolanaWasm();
  const parsedVAA = parse_vaa(signedVAA);
  const isSolanaNative =
    Buffer.from(new Uint8Array(parsedVAA.payload)).readUInt16BE(65) ===
    CHAIN_ID_SOLANA;
  const { complete_transfer_wrapped_ix, complete_transfer_native_ix } =
    await importTokenSolanaWasm();
  const ixs = [];
  if (isSolanaNative) {
    ixs.push(
      ixFromRustSolana(
        complete_transfer_native_ix(
          tokenBridgeAddress,
          bridgeAddress,
          payerAddress,
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
          signedVAA
        )
      )
    );
  }
  const transaction = new SolanaTransaction().add(...ixs);
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new SolanaPublicKey(payerAddress);
  return transaction;
}
