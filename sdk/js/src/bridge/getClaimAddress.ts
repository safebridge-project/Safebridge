import { PublicKey as SafecoinPublicKey } from "@safecoin/web3.js";
import { PublicKey as SolanaPublicKey } from "@solana/web3.js";
import { importCoreWasm as importCoreSafecoinWasm } from "../safecoin/wasm";
import { importCoreWasm as importCoreSolanaWasm } from "../solana/wasm";

export async function getClaimAddressSafecoin(
  programAddress: string,
  signedVAA: Uint8Array
) {
  const { claim_address } = await importCoreSafecoinWasm();
  return new SafecoinPublicKey(claim_address(programAddress, signedVAA));
}

export async function getClaimAddressSolana(
  programAddress: string,
  signedVAA: Uint8Array
) {
  const { claim_address } = await importCoreSolanaWasm();
  return new SolanaPublicKey(claim_address(programAddress, signedVAA));
}
