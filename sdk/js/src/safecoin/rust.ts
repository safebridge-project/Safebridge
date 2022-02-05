import {
  AccountMeta,
  PublicKey,
  TransactionInstruction,
} from "@safecoin/web3.js";
// begin from clients\safecoin\main.ts
export function ixFromRust(data: any): TransactionInstruction {
  const keys: AccountMeta[] = data.accounts.map(accountMetaFromRust);
  return new TransactionInstruction({
    programId: new PublicKey(data.program_id),
    data: Buffer.from(data.data),
    keys,
  });
}

function accountMetaFromRust(meta: any): AccountMeta {
  return {
    pubkey: new PublicKey(meta.pubkey),
    isSigner: meta.is_signer,
    isWritable: meta.is_writable,
  };
}
// end from clients\safecoin\main.ts
