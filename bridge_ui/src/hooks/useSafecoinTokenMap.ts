import { Dispatch } from "@reduxjs/toolkit";
import { ENV, TokenInfo, TokenListProvider } from "@safecoin/safe-token-registry";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { DataWrapper } from "../store/helpers";
import { selectSafecoinTokenMap } from "../store/selectors";
import {
  errorSafecoinTokenMap,
  fetchSafecoinTokenMap,
  receiveSafecoinTokenMap,
} from "../store/tokenSlice";
import { CLUSTER } from "../utils/consts";

const environment = CLUSTER === "testnet" ? ENV.Testnet : ENV.MainnetBeta;

const useSafecoinTokenMap = (): DataWrapper<TokenInfo[]> => {
  const tokenMap = useSelector(selectSafecoinTokenMap);
  const dispatch = useDispatch();
  const shouldFire =
    tokenMap.data === undefined ||
    (tokenMap.data === null && !tokenMap.isFetching);

  useEffect(() => {
    if (shouldFire) {
      getSafecoinTokenMap(dispatch);
    }
  }, [dispatch, shouldFire]);

  return tokenMap;
};

const getSafecoinTokenMap = (dispatch: Dispatch) => {
  dispatch(fetchSafecoinTokenMap());

  new TokenListProvider().resolve().then(
    (tokens) => {
      const tokenList = tokens.filterByChainId(environment).getList();
      dispatch(receiveSafecoinTokenMap(tokenList));
    },
    (error) => {
      console.error(error);
      dispatch(errorSafecoinTokenMap("Failed to retrieve the Safecoin token map."));
    }
  );
};

export default useSafecoinTokenMap;
