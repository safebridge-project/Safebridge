import { Connection as SafecoinConnection, PublicKey as SafecoinPublicKey } from "@safecoin/web3.js";
import { Connection as SolanaConnection, PublicKey as SolanaPublicKey } from "@solana/web3.js";
import { BigNumber, ethers } from "ethers";
import { arrayify, zeroPad } from "ethers/lib/utils";
import { TokenImplementation__factory } from "../ethers-contracts";
import { importNftWasm } from "../solana/wasm";
import { ChainId, CHAIN_ID_SAFECOIN, CHAIN_ID_SOLANA } from "../utils";
import { getIsWrappedAssetEth } from "./getIsWrappedAsset";

export interface WormholeWrappedNFTInfo {
  isWrapped: boolean;
  chainId: ChainId;
  assetAddress: Uint8Array;
  tokenId?: string;
}

/**
 * Returns a origin chain and asset address on {originChain} for a provided Wormhole wrapped address
 * @param tokenBridgeAddress
 * @param provider
 * @param wrappedAddress
 * @returns
 */
export async function getOriginalAssetEth(
  tokenBridgeAddress: string,
  provider: ethers.providers.Web3Provider,
  wrappedAddress: string,
  tokenId: string,
  lookupChainId: ChainId
): Promise<WormholeWrappedNFTInfo> {
  const isWrapped = await getIsWrappedAssetEth(
    tokenBridgeAddress,
    provider,
    wrappedAddress
  );
  if (isWrapped) {
    const token = TokenImplementation__factory.connect(
      wrappedAddress,
      provider
    );
    const chainId = (await token.chainId()) as ChainId; // origin chain
    const assetAddress = await token.nativeContract(); // origin address
    return {
      isWrapped: true,
      chainId,
      assetAddress:
        chainId === CHAIN_ID_SAFECOIN || CHAIN_ID_SOLANA
          ? arrayify(BigNumber.from(tokenId))
          : arrayify(assetAddress),
      tokenId, // tokenIds are maintained across EVM chains
    };
  }
  return {
    isWrapped: false,
    chainId: lookupChainId,
    assetAddress: zeroPad(arrayify(wrappedAddress), 32),
    tokenId,
  };
}

/**
 * Returns a origin chain and asset address on {originChain} for a provided Wormhole wrapped address
 * @param connection
 * @param tokenBridgeAddress
 * @param mintAddress
 * @returns
 */
export async function getOriginalAssetSafe(
  connection: SafecoinConnection,
  tokenBridgeAddress: string,
  mintAddress: string
): Promise<WormholeWrappedNFTInfo> {
  if (mintAddress) {
    // TODO: share some of this with getIsWrappedAssetSol, like a getWrappedMetaAccountAddress or something
    const { parse_wrapped_meta, wrapped_meta_address } = await importNftWasm();
    const wrappedMetaAddress = wrapped_meta_address(
      tokenBridgeAddress,
      new SafecoinPublicKey(mintAddress).toBytes()
    );
    const wrappedMetaAddressPK = new SafecoinPublicKey(wrappedMetaAddress);
    const wrappedMetaAccountInfo = await connection.getAccountInfo(
      wrappedMetaAddressPK
    );
    if (wrappedMetaAccountInfo) {
      const parsed = parse_wrapped_meta(wrappedMetaAccountInfo.data);
      const token_id_arr = parsed.token_id as BigUint64Array;
      const token_id_bytes = [];
      for (let elem of token_id_arr.reverse()) {
        token_id_bytes.push(...bigToUint8Array(elem));
      }
      const token_id = BigNumber.from(token_id_bytes).toString();
      return {
        isWrapped: true,
        chainId: parsed.chain,
        assetAddress: parsed.token_address,
        tokenId: token_id,
      };
    }
  }
  try {
    return {
      isWrapped: false,
      chainId: CHAIN_ID_SAFECOIN,
      assetAddress: new SafecoinPublicKey(mintAddress).toBytes(),
    };
  } catch (e) {}
  return {
    isWrapped: false,
    chainId: CHAIN_ID_SAFECOIN,
    assetAddress: new Uint8Array(32),
  };
}

/**
 * Returns a origin chain and asset address on {originChain} for a provided Wormhole wrapped address
 * @param connection
 * @param tokenBridgeAddress
 * @param mintAddress
 * @returns
 */
 export async function getOriginalAssetSol(
  connection: SolanaConnection,
  tokenBridgeAddress: string,
  mintAddress: string
): Promise<WormholeWrappedNFTInfo> {
  if (mintAddress) {
    // TODO: share some of this with getIsWrappedAssetSol, like a getWrappedMetaAccountAddress or something
    const { parse_wrapped_meta, wrapped_meta_address } = await importNftWasm();
    const wrappedMetaAddress = wrapped_meta_address(
      tokenBridgeAddress,
      new SolanaPublicKey(mintAddress).toBytes()
    );
    const wrappedMetaAddressPK = new SolanaPublicKey(wrappedMetaAddress);
    const wrappedMetaAccountInfo = await connection.getAccountInfo(
      wrappedMetaAddressPK
    );
    if (wrappedMetaAccountInfo) {
      const parsed = parse_wrapped_meta(wrappedMetaAccountInfo.data);
      const token_id_arr = parsed.token_id as BigUint64Array;
      const token_id_bytes = [];
      for (let elem of token_id_arr.reverse()) {
        token_id_bytes.push(...bigToUint8Array(elem));
      }
      const token_id = BigNumber.from(token_id_bytes).toString();
      return {
        isWrapped: true,
        chainId: parsed.chain,
        assetAddress: parsed.token_address,
        tokenId: token_id,
      };
    }
  }
  try {
    return {
      isWrapped: false,
      chainId: CHAIN_ID_SOLANA,
      assetAddress: new SolanaPublicKey(mintAddress).toBytes(),
    };
  } catch (e) {}
  return {
    isWrapped: false,
    chainId: CHAIN_ID_SOLANA,
    assetAddress: new Uint8Array(32),
  };
}

// Derived from https://www.jackieli.dev/posts/bigint-to-uint8array/
const big0 = BigInt(0);
const big1 = BigInt(1);
const big8 = BigInt(8);

function bigToUint8Array(big: bigint) {
  if (big < big0) {
    const bits: bigint = (BigInt(big.toString(2).length) / big8 + big1) * big8;
    const prefix1: bigint = big1 << bits;
    big += prefix1;
  }
  let hex = big.toString(16);
  if (hex.length % 2) {
    hex = "0" + hex;
  } else if (hex[0] === "8") {
    // maximum positive need to prepend 0 otherwise resuts in negative number
    hex = "00" + hex;
  }
  const len = hex.length / 2;
  const u8 = new Uint8Array(len);
  var i = 0;
  var j = 0;
  while (i < len) {
    u8[i] = parseInt(hex.slice(j, j + 2), 16);
    i += 1;
    j += 2;
  }
  return u8;
}
