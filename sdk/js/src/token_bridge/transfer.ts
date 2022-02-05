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
import { BigNumber, ethers } from "ethers";
import { isNativeDenom } from "..";
import {
  Bridge__factory,
  TokenImplementation__factory,
} from "../ethers-contracts";
import { getBridgeFeeIxSafecoin, ixFromRustSafecoin } from "../safecoin";
import { getBridgeFeeIxSolana, ixFromRustSolana } from "../solana";
import { importTokenWasm as importTokenSafecoinWasm } from "../safecoin/wasm";
import { importTokenWasm as importTokenSolanaWasm } from "../solana/wasm";
import {
  ChainId,
  CHAIN_ID_SAFECOIN,
  CHAIN_ID_SOLANA,
  createNonce,
  WSAFE_ADDRESS,
  WSOL_ADDRESS
} from "../utils";

export async function getAllowanceEth(
  tokenBridgeAddress: string,
  tokenAddress: string,
  signer: ethers.Signer
) {
  const token = TokenImplementation__factory.connect(tokenAddress, signer);
  const signerAddress = await signer.getAddress();
  const allowance = await token.allowance(signerAddress, tokenBridgeAddress);

  return allowance;
}

export async function approveEth(
  tokenBridgeAddress: string,
  tokenAddress: string,
  signer: ethers.Signer,
  amount: ethers.BigNumberish
) {
  const token = TokenImplementation__factory.connect(tokenAddress, signer);
  return await (await token.approve(tokenBridgeAddress, amount)).wait();
}

export async function transferFromEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  tokenAddress: string,
  amount: ethers.BigNumberish,
  recipientChain: ChainId,
  recipientAddress: Uint8Array
) {
  const fee = 0; // for now, this won't do anything, we may add later
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.transferTokens(
    tokenAddress,
    amount,
    recipientChain,
    recipientAddress,
    fee,
    createNonce()
  );
  const receipt = await v.wait();
  return receipt;
}

export async function transferFromEthNative(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  amount: ethers.BigNumberish,
  recipientChain: ChainId,
  recipientAddress: Uint8Array
) {
  const fee = 0; // for now, this won't do anything, we may add later
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.wrapAndTransferETH(
    recipientChain,
    recipientAddress,
    fee,
    createNonce(),
    {
      value: amount,
    }
  );
  const receipt = await v.wait();
  return receipt;
}

export async function transferFromTerra(
  walletAddress: string,
  tokenBridgeAddress: string,
  tokenAddress: string,
  amount: string,
  recipientChain: ChainId,
  recipientAddress: Uint8Array
) {
  const nonce = Math.round(Math.random() * 100000);
  const isNativeAsset = isNativeDenom(tokenAddress);
  return isNativeAsset
    ? [
        new MsgExecuteContract(
          walletAddress,
          tokenBridgeAddress,
          {
            deposit_tokens: {},
          },
          { [tokenAddress]: amount }
        ),
        new MsgExecuteContract(
          walletAddress,
          tokenBridgeAddress,
          {
            initiate_transfer: {
              asset: {
                amount,
                info: {
                  native_token: {
                    denom: tokenAddress,
                  },
                },
              },
              recipient_chain: recipientChain,
              recipient: Buffer.from(recipientAddress).toString("base64"),
              fee: "0",
              nonce: nonce,
            },
          },
          {}
        ),
      ]
    : [
        new MsgExecuteContract(
          walletAddress,
          tokenAddress,
          {
            increase_allowance: {
              spender: tokenBridgeAddress,
              amount: amount,
              expires: {
                never: {},
              },
            },
          },
          {}
        ),
        new MsgExecuteContract(
          walletAddress,
          tokenBridgeAddress,
          {
            initiate_transfer: {
              asset: {
                amount: amount,
                info: {
                  token: {
                    contract_addr: tokenAddress,
                  },
                },
              },
              recipient_chain: recipientChain,
              recipient: Buffer.from(recipientAddress).toString("base64"),
              fee: "0",
              nonce: nonce,
            },
          },
          {}
        ),
      ];
}

export async function transferNativeSafe(
  connection: SafecoinConnection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  amount: BigInt,
  targetAddress: Uint8Array,
  targetChain: ChainId
) {
  //https://github.com/solana-labs/solana-program-library/blob/master/token/js/client/token.js
  const rentBalance = await SafeToken.getMinBalanceRentForExemptAccount(connection);
  const mintPublicKey = new SafecoinPublicKey(WSAFE_ADDRESS);
  const payerPublicKey = new SafecoinPublicKey(payerAddress);
  const ancillaryKeypair = SafecoinKeypair.generate();

  //This will create a temporary account where the wSAFE will be created.
  const createAncillaryAccountIx = SafecoinSystemProgram.createAccount({
    fromPubkey: payerPublicKey,
    newAccountPubkey: ancillaryKeypair.publicKey,
    lamports: rentBalance, //spl token accounts need rent exemption
    space: SafeAccountLayout.span,
    programId: SAFE_TOKEN_PROGRAM_ID,
  });

  //Send in the amount of SAFE which we want converted to wSAFE
  const initialBalanceTransferIx = SafecoinSystemProgram.transfer({
    fromPubkey: payerPublicKey,
    lamports: Number(amount),
    toPubkey: ancillaryKeypair.publicKey,
  });
  //Initialize the account as a WSOL account, with the original payerAddress as owner
  const initAccountIx = await SafeToken.createInitAccountInstruction(
    SAFE_TOKEN_PROGRAM_ID,
    mintPublicKey,
    ancillaryKeypair.publicKey,
    payerPublicKey
  );

  //Normal approve & transfer instructions, except that the wSOL is sent from the ancillary account.
  const { transfer_native_ix, approval_authority_address } =
    await importTokenSafecoinWasm();
  const nonce = createNonce().readUInt32LE(0);
  const fee = BigInt(0); // for now, this won't do anything, we may add later
  const transferIx = await getBridgeFeeIxSafecoin(
    connection,
    bridgeAddress,
    payerAddress
  );
  const approvalIx = SafeToken.createApproveInstruction(
    SAFE_TOKEN_PROGRAM_ID,
    ancillaryKeypair.publicKey,
    new SafecoinPublicKey(approval_authority_address(tokenBridgeAddress)),
    payerPublicKey, //owner
    [],
    new Safeu64(amount.toString(16), 16)
  );
  let messageKey = SafecoinKeypair.generate();

  const ix = ixFromRustSafecoin(
    transfer_native_ix(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      messageKey.publicKey.toString(),
      ancillaryKeypair.publicKey.toString(),
      WSAFE_ADDRESS,
      nonce,
      amount,
      fee,
      targetAddress,
      targetChain
    )
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
  transaction.add(createAncillaryAccountIx);
  transaction.add(initialBalanceTransferIx);
  transaction.add(initAccountIx);
  transaction.add(transferIx, approvalIx, ix);
  transaction.add(closeAccountIx);
  transaction.partialSign(messageKey);
  transaction.partialSign(ancillaryKeypair);
  return transaction;
}

export async function transferFromSafecoin(
  connection: SafecoinConnection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  fromAddress: string,
  mintAddress: string,
  amount: BigInt,
  targetAddress: Uint8Array,
  targetChain: ChainId,
  originAddress?: Uint8Array,
  originChain?: ChainId,
  fromOwnerAddress?: string
) {
  const nonce = createNonce().readUInt32LE(0);
  const fee = BigInt(0); // for now, this won't do anything, we may add later
  const transferIx = await getBridgeFeeIxSafecoin(
    connection,
    bridgeAddress,
    payerAddress
  );
  const {
    transfer_native_ix,
    transfer_wrapped_ix,
    approval_authority_address,
  } = await importTokenSafecoinWasm();
  const approvalIx = SafeToken.createApproveInstruction(
    SAFE_TOKEN_PROGRAM_ID,
    new SafecoinPublicKey(fromAddress),
    new SafecoinPublicKey(approval_authority_address(tokenBridgeAddress)),
    new SafecoinPublicKey(fromOwnerAddress || payerAddress),
    [],
    new Safeu64(amount.toString(16), 16)
  );
  let messageKey = SafecoinKeypair.generate();
  const isSafecoinNative =
    originChain === undefined || originChain === CHAIN_ID_SAFECOIN;
  if (!isSafecoinNative && !originAddress) {
    throw new Error("originAddress is required when specifying originChain");
  }
  const ix = ixFromRustSafecoin(
    isSafecoinNative
      ? transfer_native_ix(
          tokenBridgeAddress,
          bridgeAddress,
          payerAddress,
          messageKey.publicKey.toString(),
          fromAddress,
          mintAddress,
          nonce,
          amount,
          fee,
          targetAddress,
          targetChain
        )
      : transfer_wrapped_ix(
          tokenBridgeAddress,
          bridgeAddress,
          payerAddress,
          messageKey.publicKey.toString(),
          fromAddress,
          fromOwnerAddress || payerAddress,
          originChain as number, // checked by isSolanaNative
          originAddress as Uint8Array, // checked by throw
          nonce,
          amount,
          fee,
          targetAddress,
          targetChain
        )
  );
  const transaction = new SafecoinTransaction().add(transferIx, approvalIx, ix);
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new SafecoinPublicKey(payerAddress);
  transaction.partialSign(messageKey);
  return transaction;
}

export async function transferNativeSol(
  connection: SolanaConnection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  amount: BigInt,
  targetAddress: Uint8Array,
  targetChain: ChainId
) {
  //https://github.com/solana-labs/solana-program-library/blob/master/token/js/client/token.js
  const rentBalance = await SplToken.getMinBalanceRentForExemptAccount(connection);
  const mintPublicKey = new SolanaPublicKey(WSOL_ADDRESS);
  const payerPublicKey = new SolanaPublicKey(payerAddress);
  const ancillaryKeypair = SolanaKeypair.generate();

  //This will create a temporary account where the wSOL will be created.
  const createAncillaryAccountIx = SolanaSystemProgram.createAccount({
    fromPubkey: payerPublicKey,
    newAccountPubkey: ancillaryKeypair.publicKey,
    lamports: rentBalance, //spl token accounts need rent exemption
    space: SplAccountLayout.span,
    programId: SPL_TOKEN_PROGRAM_ID,
  });

  //Send in the amount of SOL which we want converted to wSOL
  const initialBalanceTransferIx = SolanaSystemProgram.transfer({
    fromPubkey: payerPublicKey,
    lamports: Number(amount),
    toPubkey: ancillaryKeypair.publicKey,
  });
  //Initialize the account as a WSOL account, with the original payerAddress as owner
  const initAccountIx = await SplToken.createInitAccountInstruction(
    SPL_TOKEN_PROGRAM_ID,
    mintPublicKey,
    ancillaryKeypair.publicKey,
    payerPublicKey
  );

  //Normal approve & transfer instructions, except that the wSOL is sent from the ancillary account.
  const { transfer_native_ix, approval_authority_address } =
    await importTokenSolanaWasm();
  const nonce = createNonce().readUInt32LE(0);
  const fee = BigInt(0); // for now, this won't do anything, we may add later
  const transferIx = await getBridgeFeeIxSolana(
    connection,
    bridgeAddress,
    payerAddress
  );
  const approvalIx = SplToken.createApproveInstruction(
    SPL_TOKEN_PROGRAM_ID,
    ancillaryKeypair.publicKey,
    new SolanaPublicKey(approval_authority_address(tokenBridgeAddress)),
    payerPublicKey, //owner
    [],
    new Splu64(amount.toString(16), 16)
  );
  let messageKey = SolanaKeypair.generate();

  const ix = ixFromRustSolana(
    transfer_native_ix(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      messageKey.publicKey.toString(),
      ancillaryKeypair.publicKey.toString(),
      WSOL_ADDRESS,
      nonce,
      amount,
      fee,
      targetAddress,
      targetChain
    )
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
  transaction.add(createAncillaryAccountIx);
  transaction.add(initialBalanceTransferIx);
  transaction.add(initAccountIx);
  transaction.add(transferIx, approvalIx, ix);
  transaction.add(closeAccountIx);
  transaction.partialSign(messageKey);
  transaction.partialSign(ancillaryKeypair);
  return transaction;
}

export async function transferFromSolana(
  connection: SolanaConnection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  fromAddress: string,
  mintAddress: string,
  amount: BigInt,
  targetAddress: Uint8Array,
  targetChain: ChainId,
  originAddress?: Uint8Array,
  originChain?: ChainId,
  fromOwnerAddress?: string
) {
  const nonce = createNonce().readUInt32LE(0);
  const fee = BigInt(0); // for now, this won't do anything, we may add later
  const transferIx = await getBridgeFeeIxSolana(
    connection,
    bridgeAddress,
    payerAddress
  );
  const {
    transfer_native_ix,
    transfer_wrapped_ix,
    approval_authority_address,
  } = await importTokenSolanaWasm();
  const approvalIx = SplToken.createApproveInstruction(
    SPL_TOKEN_PROGRAM_ID,
    new SolanaPublicKey(fromAddress),
    new SolanaPublicKey(approval_authority_address(tokenBridgeAddress)),
    new SolanaPublicKey(fromOwnerAddress || payerAddress),
    [],
    new Splu64(amount.toString(16), 16)
  );
  let messageKey = SolanaKeypair.generate();
  const isSolanaNative =
    originChain === undefined || originChain === CHAIN_ID_SOLANA;
  if (!isSolanaNative && !originAddress) {
    throw new Error("originAddress is required when specifying originChain");
  }
  const ix = ixFromRustSolana(
    isSolanaNative
      ? transfer_native_ix(
          tokenBridgeAddress,
          bridgeAddress,
          payerAddress,
          messageKey.publicKey.toString(),
          fromAddress,
          mintAddress,
          nonce,
          amount,
          fee,
          targetAddress,
          targetChain
        )
      : transfer_wrapped_ix(
          tokenBridgeAddress,
          bridgeAddress,
          payerAddress,
          messageKey.publicKey.toString(),
          fromAddress,
          fromOwnerAddress || payerAddress,
          originChain as number, // checked by isSolanaNative
          originAddress as Uint8Array, // checked by throw
          nonce,
          amount,
          fee,
          targetAddress,
          targetChain
        )
  );
  const transaction = new SolanaTransaction().add(transferIx, approvalIx, ix);
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new SolanaPublicKey(payerAddress);
  transaction.partialSign(messageKey);
  return transaction;
}
