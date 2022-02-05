import { PublicKey as SafecoinPublicKey } from "@safecoin/web3.js";
import { PublicKey as SolanaPublicKey } from "@solana/web3.js";
import { bech32 } from "bech32";
import { arrayify, BytesLike, Hexable, zeroPad } from "ethers/lib/utils";
import { importTokenWasm as importTokenSafecoinWasm } from "../safecoin/wasm";
import { importTokenWasm as importTokenSolanaWasm } from "../solana/wasm";

export function getEmitterAddressEth(
  contractAddress: number | BytesLike | Hexable
) {
  return Buffer.from(zeroPad(arrayify(contractAddress), 32)).toString("hex");
}

export async function getEmitterAddressSafecoin(programAddress: string) {
  const { emitter_address } = await importTokenSafecoinWasm();
  return Buffer.from(
    zeroPad(new SafecoinPublicKey(emitter_address(programAddress)).toBytes(), 32)
  ).toString("hex");
}

export async function getEmitterAddressSolana(programAddress: string) {
  const { emitter_address } = await importTokenSolanaWasm();
  return Buffer.from(
    zeroPad(new SolanaPublicKey(emitter_address(programAddress)).toBytes(), 32)
  ).toString("hex");
}

export async function getEmitterAddressTerra(programAddress: string) {
  return Buffer.from(
    zeroPad(bech32.fromWords(bech32.decode(programAddress).words), 32)
  ).toString("hex");
}
