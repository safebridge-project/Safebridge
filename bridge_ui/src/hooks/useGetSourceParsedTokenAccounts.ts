import {
  ChainId,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SAFECOIN,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  WSAFE_ADDRESS,
  WSAFE_DECIMALS,
  WSOL_ADDRESS,
  WSOL_DECIMALS,
} from "@certusone/wormhole-sdk";
import { ethers } from "@certusone/wormhole-sdk/node_modules/ethers";
import { Dispatch } from "@reduxjs/toolkit";
import { TOKEN_PROGRAM_ID as SAFE_TOKEN_PROGRAM_ID } from "@safecoin/safe-token";
import { TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {
  AccountInfo as SafecoinAccountInfo,
  Connection as SafecoinConnection,
  ParsedAccountData as SafecoinParsedAccountData,
  PublicKey as SafecoinPublicKey,
} from "@safecoin/web3.js";
import {
  AccountInfo as SolanaAccountInfo,
  Connection as SolanaConnection,
  ParsedAccountData as SolanaParsedAccountData,
  PublicKey as SolanaPublicKey,
} from "@solana/web3.js";
import axios from "axios";
import { formatUnits } from "ethers/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Provider,
  useEthereumProvider,
} from "../contexts/EthereumProviderContext";
import { useSafecoinWallet } from "../contexts/SafecoinWalletContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import {
  errorSourceParsedTokenAccounts as errorSourceParsedTokenAccountsNFT,
  fetchSourceParsedTokenAccounts as fetchSourceParsedTokenAccountsNFT,
  NFTParsedTokenAccount,
  receiveSourceParsedTokenAccounts as receiveSourceParsedTokenAccountsNFT,
  setSourceParsedTokenAccount as setSourceParsedTokenAccountNFT,
  setSourceParsedTokenAccounts as setSourceParsedTokenAccountsNFT,
  setSourceWalletAddress as setSourceWalletAddressNFT,
} from "../store/nftSlice";
import {
  selectNFTSourceChain,
  selectNFTSourceParsedTokenAccounts,
  selectNFTSourceWalletAddress,
  selectSourceWalletAddress,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccounts,
} from "../store/selectors";
import {
  errorSourceParsedTokenAccounts,
  fetchSourceParsedTokenAccounts,
  ParsedTokenAccount,
  receiveSourceParsedTokenAccounts,
  setAmount,
  setSourceParsedTokenAccount,
  setSourceParsedTokenAccounts,
  setSourceWalletAddress,
} from "../store/transferSlice";
import {
  COVALENT_GET_TOKENS_URL,
  SAFECOIN_HOST,
  SOLANA_HOST,
  WBNB_ADDRESS,
  WBNB_DECIMALS,
  WETH_ADDRESS,
  WETH_DECIMALS,
  WMATIC_ADDRESS,
  WMATIC_DECIMALS,
} from "../utils/consts";
import { isEVMChain } from "../utils/ethereum";
import  {
  ExtractedMintInfo as ExtractedSafecoinMintInfo,
  extractMintInfo as extractSafecoinMintInfo,
  getMultipleAccountsRPC as getMultipleSafecoinAccountsRPC,
} from "../utils/safecoin";
import {
  ExtractedMintInfo as ExtractedSolanaMintInfo,
  extractMintInfo as extractSolanaMintInfo,
  getMultipleAccountsRPC as getMultipleSolanaAccountsRPC,
} from "../utils/solana";
import bnbIcon from "../icons/bnb.svg";
import ethIcon from "../icons/eth.svg";
import polygonIcon from "../icons/polygon.svg";

export function createParsedTokenAccount(
  publicKey: string,
  mintKey: string,
  amount: string,
  decimals: number,
  uiAmount: number,
  uiAmountString: string,
  symbol?: string,
  name?: string,
  logo?: string,
  isNativeAsset?: boolean
): ParsedTokenAccount {
  return {
    publicKey: publicKey,
    mintKey: mintKey,
    amount,
    decimals,
    uiAmount,
    uiAmountString,
    symbol,
    name,
    logo,
    isNativeAsset,
  };
}

export function createNFTParsedTokenAccount(
  publicKey: string,
  mintKey: string,
  amount: string,
  decimals: number,
  uiAmount: number,
  uiAmountString: string,
  tokenId: string,
  symbol?: string,
  name?: string,
  uri?: string,
  animation_url?: string,
  external_url?: string,
  image?: string,
  image_256?: string,
  nftName?: string,
  description?: string
): NFTParsedTokenAccount {
  return {
    publicKey,
    mintKey,
    amount,
    decimals,
    uiAmount,
    uiAmountString,
    tokenId,
    uri,
    animation_url,
    external_url,
    image,
    image_256,
    symbol,
    name,
    nftName,
    description,
  };
}

const createParsedSafecoinTokenAccountFromInfo = (
  pubkey: SafecoinPublicKey,
  item: SafecoinAccountInfo<SafecoinParsedAccountData>
): ParsedTokenAccount => {
  return {
    publicKey: pubkey?.toString(),
    mintKey: item.data.parsed?.info?.mint?.toString(),
    amount: item.data.parsed?.info?.tokenAmount?.amount,
    decimals: item.data.parsed?.info?.tokenAmount?.decimals,
    uiAmount: item.data.parsed?.info?.tokenAmount?.uiAmount,
    uiAmountString: item.data.parsed?.info?.tokenAmount?.uiAmountString,
  };
};

const createParsedTokenAccountFromInfo = (
  pubkey: SolanaPublicKey,
  item: SolanaAccountInfo<SolanaParsedAccountData>
): ParsedTokenAccount => {
  return {
    publicKey: pubkey?.toString(),
    mintKey: item.data.parsed?.info?.mint?.toString(),
    amount: item.data.parsed?.info?.tokenAmount?.amount,
    decimals: item.data.parsed?.info?.tokenAmount?.decimals,
    uiAmount: item.data.parsed?.info?.tokenAmount?.uiAmount,
    uiAmountString: item.data.parsed?.info?.tokenAmount?.uiAmountString,
  };
};

const createParsedTokenAccountFromCovalent = (
  walletAddress: string,
  covalent: CovalentData
): ParsedTokenAccount => {
  return {
    publicKey: walletAddress,
    mintKey: covalent.contract_address,
    amount: covalent.balance,
    decimals: covalent.contract_decimals,
    uiAmount: Number(formatUnits(covalent.balance, covalent.contract_decimals)),
    uiAmountString: formatUnits(covalent.balance, covalent.contract_decimals),
    symbol: covalent.contract_ticker_symbol,
    name: covalent.contract_name,
    logo: covalent.logo_url,
  };
};

const createNativeSafeParsedTokenAccount = async (
  connection: SafecoinConnection,
  walletAddress: string
) => {
  // const walletAddress = "H69q3Q8E74xm7swmMQpsJLVp2Q9JuBwBbxraAMX5Drzm" // known solana mainnet wallet with tokens
  const fetchAccounts = await getMultipleSafecoinAccountsRPC(connection, [
    new SafecoinPublicKey(walletAddress),
  ]);
  if (!fetchAccounts || !fetchAccounts.length || !fetchAccounts[0]) {
    return null;
  } else {
    return createParsedTokenAccount(
      walletAddress, //publicKey
      WSAFE_ADDRESS, //Mint key
      fetchAccounts[0].lamports.toString(), //amount
      WSAFE_DECIMALS, //decimals, 9
      parseFloat(formatUnits(fetchAccounts[0].lamports, WSAFE_DECIMALS)),
      formatUnits(fetchAccounts[0].lamports, WSAFE_DECIMALS).toString(),
      "SAFE",
      "Safecoin",
      undefined, //TODO logo. It's in the solana token map, so we could potentially use that URL.
      true
    );
  }
};

const createNativeSolParsedTokenAccount = async (
  connection: SolanaConnection,
  walletAddress: string
) => {
  // const walletAddress = "H69q3Q8E74xm7swmMQpsJLVp2Q9JuBwBbxraAMX5Drzm" // known solana mainnet wallet with tokens
  const fetchAccounts = await getMultipleSolanaAccountsRPC(connection, [
    new SolanaPublicKey(walletAddress),
  ]);
  if (!fetchAccounts || !fetchAccounts.length || !fetchAccounts[0]) {
    return null;
  } else {
    return createParsedTokenAccount(
      walletAddress, //publicKey
      WSOL_ADDRESS, //Mint key
      fetchAccounts[0].lamports.toString(), //amount
      WSOL_DECIMALS, //decimals, 9
      parseFloat(formatUnits(fetchAccounts[0].lamports, WSOL_DECIMALS)),
      formatUnits(fetchAccounts[0].lamports, WSOL_DECIMALS).toString(),
      "SOL",
      "Solana",
      undefined, //TODO logo. It's in the solana token map, so we could potentially use that URL.
      true
    );
  }
};

const createNativeEthParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          WETH_ADDRESS, //Mint key, On the other side this will be WETH, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          WETH_DECIMALS, //Luckily both ETH and WETH have 18 decimals, so this should not be an issue.
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "ETH", //A white lie for display purposes
          "Ethereum", //A white lie for display purposes
          ethIcon,
          true //isNativeAsset
        );
      });
};

const createNativeBscParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          WBNB_ADDRESS, //Mint key, On the other side this will be WBNB, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          WBNB_DECIMALS, //Luckily both BNB and WBNB have 18 decimals, so this should not be an issue.
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "BNB", //A white lie for display purposes
          "Binance Coin", //A white lie for display purposes
          bnbIcon,
          true //isNativeAsset
        );
      });
};

const createNativePolygonParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          WMATIC_ADDRESS, //Mint key, On the other side this will be WMATIC, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          WMATIC_DECIMALS, //Luckily both MATIC and WMATIC have 18 decimals, so this should not be an issue.
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "MATIC", //A white lie for display purposes
          "Matic", //A white lie for display purposes
          polygonIcon,
          true //isNativeAsset
        );
      });
};

const createNFTParsedTokenAccountFromCovalent = (
  walletAddress: string,
  covalent: CovalentData,
  nft_data: CovalentNFTData
): NFTParsedTokenAccount => {
  return {
    publicKey: walletAddress,
    mintKey: covalent.contract_address,
    amount: nft_data.token_balance,
    decimals: covalent.contract_decimals,
    uiAmount: Number(
      formatUnits(nft_data.token_balance, covalent.contract_decimals)
    ),
    uiAmountString: formatUnits(
      nft_data.token_balance,
      covalent.contract_decimals
    ),
    symbol: covalent.contract_ticker_symbol,
    name: covalent.contract_name,
    logo: covalent.logo_url,
    tokenId: nft_data.token_id,
    uri: nft_data.token_url,
    animation_url: nft_data.external_data.animation_url,
    external_url: nft_data.external_data.external_url,
    image: nft_data.external_data.image,
    image_256: nft_data.external_data.image_256,
    nftName: nft_data.external_data.name,
    description: nft_data.external_data.description,
  };
};

export type CovalentData = {
  contract_decimals: number;
  contract_ticker_symbol: string;
  contract_name: string;
  contract_address: string;
  logo_url: string | undefined;
  balance: string;
  quote: number | undefined;
  quote_rate: number | undefined;
  nft_data?: CovalentNFTData[];
};

export type CovalentNFTExternalData = {
  animation_url: string | null;
  external_url: string | null;
  image: string;
  image_256: string;
  name: string;
  description: string;
};

export type CovalentNFTData = {
  token_id: string;
  token_balance: string;
  external_data: CovalentNFTExternalData;
  token_url: string;
};

const getEthereumAccountsCovalent = async (
  walletAddress: string,
  nft: boolean,
  chainId: ChainId
): Promise<CovalentData[]> => {
  const url = COVALENT_GET_TOKENS_URL(chainId, walletAddress, nft);

  try {
    const output = [] as CovalentData[];
    const response = await axios.get(url);
    const tokens = response.data.data.items;

    if (tokens instanceof Array && tokens.length) {
      for (const item of tokens) {
        // TODO: filter?
        if (
          item.contract_decimals !== undefined &&
          item.contract_address &&
          item.balance &&
          item.balance !== "0" &&
          (nft
            ? item.supports_erc?.includes("erc721")
            : item.supports_erc?.includes("erc20"))
        ) {
          output.push({ ...item } as CovalentData);
        }
      }
    }

    return output;
  } catch (error) {
    return Promise.reject("Unable to retrieve your Ethereum Tokens.");
  }
};

const getSafecoinParsedTokenAccounts = async (
  walletAddress: string,
  dispatch: Dispatch,
  nft: boolean
) => {
  const connection = new SafecoinConnection(SAFECOIN_HOST, "confirmed");
  dispatch(
    nft ? fetchSourceParsedTokenAccountsNFT() : fetchSourceParsedTokenAccounts()
  );
  try {
    //No matter what, we retrieve the spl tokens associated to this address.
    let splParsedTokenAccounts = await connection
      .getParsedTokenAccountsByOwner(new SafecoinPublicKey(walletAddress), {
        programId: new SafecoinPublicKey(SAFE_TOKEN_PROGRAM_ID),
      })
      .then((result) => {
        return result.value.map((item) =>
          createParsedSafecoinTokenAccountFromInfo(item.pubkey, item.account)
        );
      });

    // uncomment to test token account in picker, useful for debugging
    // splParsedTokenAccounts.push({
    //   amount: "1",
    //   decimals: 8,
    //   mintKey: "2Xf2yAXJfg82sWwdLUo2x9mZXy6JCdszdMZkcF1Hf4KV",
    //   publicKey: "2Xf2yAXJfg82sWwdLUo2x9mZXy6JCdszdMZkcF1Hf4KV",
    //   uiAmount: 1,
    //   uiAmountString: "1",
    //   isNativeAsset: false,
    // });

    if (nft) {
      //In the case of NFTs, we are done, and we set the accounts in redux
      dispatch(receiveSourceParsedTokenAccountsNFT(splParsedTokenAccounts));
    } else {
      //In the transfer case, we also pull the SOL balance of the wallet, and prepend it at the beginning of the list.
      const nativeAccount = await createNativeSafeParsedTokenAccount(
        connection,
        walletAddress
      );
      if (nativeAccount !== null) {
        splParsedTokenAccounts.unshift(nativeAccount);
      }
      dispatch(receiveSourceParsedTokenAccounts(splParsedTokenAccounts));
    }
  } catch (e) {
    console.error(e);
    dispatch(
      nft
        ? errorSourceParsedTokenAccountsNFT("Failed to load NFT metadata")
        : errorSourceParsedTokenAccounts("Failed to load token metadata.")
    );
  }
};

const getSolanaParsedTokenAccounts = async (
  walletAddress: string,
  dispatch: Dispatch,
  nft: boolean
) => {
  const connection = new SolanaConnection(SOLANA_HOST, "confirmed");
  dispatch(
    nft ? fetchSourceParsedTokenAccountsNFT() : fetchSourceParsedTokenAccounts()
  );
  try {
    //No matter what, we retrieve the spl tokens associated to this address.
    let splParsedTokenAccounts = await connection
      .getParsedTokenAccountsByOwner(new SolanaPublicKey(walletAddress), {
        programId: new SolanaPublicKey(SPL_TOKEN_PROGRAM_ID),
      })
      .then((result) => {
        return result.value.map((item) =>
          createParsedTokenAccountFromInfo(item.pubkey, item.account)
        );
      });

    // uncomment to test token account in picker, useful for debugging
    // splParsedTokenAccounts.push({
    //   amount: "1",
    //   decimals: 8,
    //   mintKey: "2Xf2yAXJfg82sWwdLUo2x9mZXy6JCdszdMZkcF1Hf4KV",
    //   publicKey: "2Xf2yAXJfg82sWwdLUo2x9mZXy6JCdszdMZkcF1Hf4KV",
    //   uiAmount: 1,
    //   uiAmountString: "1",
    //   isNativeAsset: false,
    // });

    if (nft) {
      //In the case of NFTs, we are done, and we set the accounts in redux
      dispatch(receiveSourceParsedTokenAccountsNFT(splParsedTokenAccounts));
    } else {
      //In the transfer case, we also pull the SOL balance of the wallet, and prepend it at the beginning of the list.
      const nativeAccount = await createNativeSolParsedTokenAccount(
        connection,
        walletAddress
      );
      if (nativeAccount !== null) {
        splParsedTokenAccounts.unshift(nativeAccount);
      }
      dispatch(receiveSourceParsedTokenAccounts(splParsedTokenAccounts));
    }
  } catch (e) {
    console.error(e);
    dispatch(
      nft
        ? errorSourceParsedTokenAccountsNFT("Failed to load NFT metadata")
        : errorSourceParsedTokenAccounts("Failed to load token metadata.")
    );
  }
};

/**
 * Fetches the balance of an asset for the connected wallet
 * This should handle every type of chain in the future, but only reads the Transfer state.
 */
function useGetAvailableTokens(nft: boolean = false) {
  const dispatch = useDispatch();

  const tokenAccounts = useSelector(
    nft
      ? selectNFTSourceParsedTokenAccounts
      : selectTransferSourceParsedTokenAccounts
  );

  const lookupChain = useSelector(
    nft ? selectNFTSourceChain : selectTransferSourceChain
  );

  const safecoinWallet = useSafecoinWallet();
  const safePK = safecoinWallet?.publicKey;

  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const { provider, signerAddress } = useEthereumProvider();

  const [covalent, setCovalent] = useState<any>(undefined);
  const [covalentLoading, setCovalentLoading] = useState(false);
  const [covalentError, setCovalentError] = useState<string | undefined>(
    undefined
  );

  const [ethNativeAccount, setEthNativeAccount] = useState<any>(undefined);
  const [ethNativeAccountLoading, setEthNativeAccountLoading] = useState(false);
  const [ethNativeAccountError, setEthNativeAccountError] = useState<
    string | undefined
  >(undefined);

  const [safecoinMintAccounts, setSafecoinMintAccounts] = useState<
    Map<string, ExtractedSafecoinMintInfo | null> | undefined
  >(undefined);
  const [safecoinMintAccountsLoading, setSafecoinMintAccountsLoading] =
    useState(false);
  const [safecoinMintAccountsError, setSafecoinMintAccountsError] = useState<
    string | undefined
  >(undefined);


  const [solanaMintAccounts, setSolanaMintAccounts] = useState<
    Map<string, ExtractedSolanaMintInfo | null> | undefined
  >(undefined);
  const [solanaMintAccountsLoading, setSolanaMintAccountsLoading] =
    useState(false);
  const [solanaMintAccountsError, setSolanaMintAccountsError] = useState<
    string | undefined
  >(undefined);

  const selectedSourceWalletAddress = useSelector(
    nft ? selectNFTSourceWalletAddress : selectSourceWalletAddress
  );
  const currentSourceWalletAddress: string | undefined = isEVMChain(lookupChain)
    ? signerAddress
    : lookupChain === CHAIN_ID_SAFECOIN
    ? safePK?.toString()
    : lookupChain === CHAIN_ID_SOLANA
    ? solPK?.toString()
    : undefined;

  const resetSourceAccounts = useCallback(() => {
    dispatch(
      nft
        ? setSourceWalletAddressNFT(undefined)
        : setSourceWalletAddress(undefined)
    );
    dispatch(
      nft
        ? setSourceParsedTokenAccountNFT(undefined)
        : setSourceParsedTokenAccount(undefined)
    );
    dispatch(
      nft
        ? setSourceParsedTokenAccountsNFT(undefined)
        : setSourceParsedTokenAccounts(undefined)
    );
    !nft && dispatch(setAmount(""));
    setCovalent(undefined); //These need to be included in the reset because they have balances on them.
    setCovalentLoading(false);
    setCovalentError("");

    setEthNativeAccount(undefined);
    setEthNativeAccountLoading(false);
    setEthNativeAccountError("");
  }, [setCovalent, dispatch, nft]);

  //TODO this useEffect could be somewhere else in the codebase
  //It resets the SourceParsedTokens accounts when the wallet changes
  useEffect(() => {
    if (
      selectedSourceWalletAddress !== undefined &&
      currentSourceWalletAddress !== undefined &&
      currentSourceWalletAddress !== selectedSourceWalletAddress
    ) {
      resetSourceAccounts();
      return;
    } else {
    }
  }, [
    selectedSourceWalletAddress,
    currentSourceWalletAddress,
    dispatch,
    resetSourceAccounts,
  ]);

  //Safecoin accountinfos load
  useEffect(() => {
    if (lookupChain === CHAIN_ID_SAFECOIN && safePK) {
      if (
        !(tokenAccounts.data || tokenAccounts.isFetching || tokenAccounts.error)
      ) {
        getSafecoinParsedTokenAccounts(safePK.toString(), dispatch, nft);
      }
    }

    return () => {};
  }, [dispatch, safecoinWallet, lookupChain, safePK, tokenAccounts, nft]);

  //Solana accountinfos load
  useEffect(() => {
    if (lookupChain === CHAIN_ID_SOLANA && solPK) {
      if (
        !(tokenAccounts.data || tokenAccounts.isFetching || tokenAccounts.error)
      ) {
        getSolanaParsedTokenAccounts(solPK.toString(), dispatch, nft);
      }
    }

    return () => {};
  }, [dispatch, solanaWallet, lookupChain, solPK, tokenAccounts, nft]);

  //Safecoin Mint Accounts lookup
  useEffect(() => {
    if (lookupChain !== CHAIN_ID_SAFECOIN || !tokenAccounts.data?.length) {
      return () => {};
    }

    let cancelled = false;
    setSafecoinMintAccountsLoading(true);
    setSafecoinMintAccountsError(undefined);
    const mintAddresses = tokenAccounts.data.map((x) => x.mintKey);
    //This is a known wormhole v1 token on testnet
    // mintAddresses.push("4QixXecTZ4zdZGa39KH8gVND5NZ2xcaB12wiBhE4S7rn");
    //SOLT devnet token
    // mintAddresses.push("2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ");
    // bad monkey "NFT"
    // mintAddresses.push("5FJeEJR8576YxXFdGRAu4NBBFcyfmtjsZrXHSsnzNPdS");
    // degenerate monkey NFT
    // mintAddresses.push("EzYsbigNNGbNuANRJ3mnnyJYU2Bk7mBYVsxuonUwAX7r");

    const connection = new SafecoinConnection(SAFECOIN_HOST, "confirmed");
    getMultipleSafecoinAccountsRPC(
      connection,
      mintAddresses.map((x) => new SafecoinPublicKey(x))
    ).then(
      (results) => {
        if (!cancelled) {
          const output = new Map<string, ExtractedSafecoinMintInfo | null>();

          results.forEach((result, index) =>
            output.set(
              mintAddresses[index],
              (result && extractSafecoinMintInfo(result)) || null
            )
          );

          setSafecoinMintAccounts(output);
          setSafecoinMintAccountsLoading(false);
        }
      },
      (error) => {
        if (!cancelled) {
          setSafecoinMintAccounts(undefined);
          setSafecoinMintAccountsLoading(false);
          setSafecoinMintAccountsError(
            "Could not retrieve Safecoin mint accounts."
          );
        }
      }
    );

    return () => (cancelled = true);
  }, [tokenAccounts.data, lookupChain]);

  //Solana Mint Accounts lookup
  useEffect(() => {
    if (lookupChain !== CHAIN_ID_SOLANA || !tokenAccounts.data?.length) {
      return () => {};
    }

    let cancelled = false;
    setSolanaMintAccountsLoading(true);
    setSolanaMintAccountsError(undefined);
    const mintAddresses = tokenAccounts.data.map((x) => x.mintKey);
    //This is a known wormhole v1 token on testnet
    // mintAddresses.push("4QixXecTZ4zdZGa39KH8gVND5NZ2xcaB12wiBhE4S7rn");
    //SOLT devnet token
    // mintAddresses.push("2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ");
    // bad monkey "NFT"
    // mintAddresses.push("5FJeEJR8576YxXFdGRAu4NBBFcyfmtjsZrXHSsnzNPdS");
    // degenerate monkey NFT
    // mintAddresses.push("EzYsbigNNGbNuANRJ3mnnyJYU2Bk7mBYVsxuonUwAX7r");

    const connection = new SolanaConnection(SOLANA_HOST, "confirmed");
    getMultipleSolanaAccountsRPC(
      connection,
      mintAddresses.map((x) => new SolanaPublicKey(x))
    ).then(
      (results) => {
        if (!cancelled) {
          const output = new Map<string, ExtractedSolanaMintInfo | null>();

          results.forEach((result, index) =>
            output.set(
              mintAddresses[index],
              (result && extractSolanaMintInfo(result)) || null
            )
          );

          setSolanaMintAccounts(output);
          setSolanaMintAccountsLoading(false);
        }
      },
      (error) => {
        if (!cancelled) {
          setSolanaMintAccounts(undefined);
          setSolanaMintAccountsLoading(false);
          setSolanaMintAccountsError(
            "Could not retrieve Solana mint accounts."
          );
        }
      }
    );

    return () => (cancelled = true);
  }, [tokenAccounts.data, lookupChain]);

  //Ethereum native asset load
  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_ETH &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeEthParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your ETH balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  //Binance Smart Chain native asset load
  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_BSC &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeBscParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your BNB balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  //Polygon native asset load
  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_POLYGON &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativePolygonParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your MATIC balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  //Ethereum covalent accounts load
  useEffect(() => {
    //const testWallet = "0xf60c2ea62edbfe808163751dd0d8693dcb30019c";
    // const nftTestWallet1 = "0x3f304c6721f35ff9af00fd32650c8e0a982180ab";
    // const nftTestWallet2 = "0x98ed231428088eb440e8edb5cc8d66dcf913b86e";
    // const nftTestWallet3 = "0xb1fadf677a7e9b90e9d4f31c8ffb3dc18c138c6f";
    // const nftBscTestWallet1 = "0x5f464a652bd1991df0be37979b93b3306d64a909";
    let cancelled = false;
    const walletAddress = signerAddress;
    if (walletAddress && isEVMChain(lookupChain) && !covalent) {
      //TODO less cancel
      !cancelled && setCovalentLoading(true);
      !cancelled &&
        dispatch(
          nft
            ? fetchSourceParsedTokenAccountsNFT()
            : fetchSourceParsedTokenAccounts()
        );
      getEthereumAccountsCovalent(walletAddress, nft, lookupChain).then(
        (accounts) => {
          !cancelled && setCovalentLoading(false);
          !cancelled && setCovalentError(undefined);
          !cancelled && setCovalent(accounts);
          !cancelled &&
            dispatch(
              nft
                ? receiveSourceParsedTokenAccountsNFT(
                    accounts.reduce((arr, current) => {
                      if (current.nft_data) {
                        current.nft_data.forEach((x) =>
                          arr.push(
                            createNFTParsedTokenAccountFromCovalent(
                              walletAddress,
                              current,
                              x
                            )
                          )
                        );
                      }
                      return arr;
                    }, [] as NFTParsedTokenAccount[])
                  )
                : receiveSourceParsedTokenAccounts(
                    accounts.map((x) =>
                      createParsedTokenAccountFromCovalent(walletAddress, x)
                    )
                  )
            );
        },
        () => {
          !cancelled &&
            dispatch(
              nft
                ? errorSourceParsedTokenAccountsNFT(
                    "Cannot load your Ethereum NFTs at the moment."
                  )
                : errorSourceParsedTokenAccounts(
                    "Cannot load your Ethereum tokens at the moment."
                  )
            );
          !cancelled &&
            setCovalentError("Cannot load your Ethereum tokens at the moment.");
          !cancelled && setCovalentLoading(false);
        }
      );

      return () => {
        cancelled = true;
      };
    }
  }, [lookupChain, provider, signerAddress, dispatch, nft, covalent]);

  //Terra accounts load
  //At present, we don't have any mechanism for doing this.
  useEffect(() => {}, []);

  const ethAccounts = useMemo(() => {
    const output = { ...tokenAccounts };
    output.data = output.data?.slice() || [];
    output.isFetching = output.isFetching || ethNativeAccountLoading;
    output.error = output.error || ethNativeAccountError;
    ethNativeAccount && output.data && output.data.unshift(ethNativeAccount);
    return output;
  }, [
    ethNativeAccount,
    ethNativeAccountLoading,
    ethNativeAccountError,
    tokenAccounts,
  ]);

  return lookupChain === CHAIN_ID_SAFECOIN
    ? {
        tokenAccounts: tokenAccounts,
        mintAccounts: {
          data: safecoinMintAccounts,
          isFetching: safecoinMintAccountsLoading,
          error: safecoinMintAccountsError,
          receivedAt: null, //TODO
        },
        resetAccounts: resetSourceAccounts,
      }
    : lookupChain === CHAIN_ID_SOLANA
    ? {
        tokenAccounts: tokenAccounts,
        mintAccounts: {
          data: solanaMintAccounts,
          isFetching: solanaMintAccountsLoading,
          error: solanaMintAccountsError,
          receivedAt: null, //TODO
        },
        resetAccounts: resetSourceAccounts,
      }
    : isEVMChain(lookupChain)
    ? {
        tokenAccounts: ethAccounts,
        covalent: {
          data: covalent,
          isFetching: covalentLoading,
          error: covalentError,
          receivedAt: null, //TODO
        },
        resetAccounts: resetSourceAccounts,
      }
    : lookupChain === CHAIN_ID_TERRA
    ? {
        resetAccounts: resetSourceAccounts,
      }
    : undefined;
}

export default useGetAvailableTokens;
