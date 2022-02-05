import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { TokenInfo } from "@solana/spl-token-registry";
import { TerraTokenMap } from "../hooks/useTerraTokenMap";
import {
  DataWrapper,
  errorDataWrapper,
  fetchDataWrapper,
  getEmptyDataWrapper,
  receiveDataWrapper,
} from "./helpers";

export interface TokenMetadataState {
  safecoinTokenMap: DataWrapper<TokenInfo[]>;
  solanaTokenMap: DataWrapper<TokenInfo[]>;
  terraTokenMap: DataWrapper<TerraTokenMap>; //TODO make a decent type for this.
}

const initialState: TokenMetadataState = {
  safecoinTokenMap: getEmptyDataWrapper(),
  solanaTokenMap: getEmptyDataWrapper(),
  terraTokenMap: getEmptyDataWrapper(),
};

export const tokenSlice = createSlice({
  name: "tokenInfos",
  initialState,
  reducers: {
    receiveSafecoinTokenMap: (state, action: PayloadAction<TokenInfo[]>) => {
      state.safecoinTokenMap = receiveDataWrapper(action.payload);
    },
    fetchSafecoinTokenMap: (state) => {
      state.safecoinTokenMap = fetchDataWrapper();
    },
    errorSafecoinTokenMap: (state, action: PayloadAction<string>) => {
      state.safecoinTokenMap = errorDataWrapper(action.payload);
    },

    receiveSolanaTokenMap: (state, action: PayloadAction<TokenInfo[]>) => {
      state.solanaTokenMap = receiveDataWrapper(action.payload);
    },
    fetchSolanaTokenMap: (state) => {
      state.solanaTokenMap = fetchDataWrapper();
    },
    errorSolanaTokenMap: (state, action: PayloadAction<string>) => {
      state.solanaTokenMap = errorDataWrapper(action.payload);
    },

    receiveTerraTokenMap: (state, action: PayloadAction<TerraTokenMap>) => {
      state.terraTokenMap = receiveDataWrapper(action.payload);
    },
    fetchTerraTokenMap: (state) => {
      state.terraTokenMap = fetchDataWrapper();
    },
    errorTerraTokenMap: (state, action: PayloadAction<string>) => {
      state.terraTokenMap = errorDataWrapper(action.payload);
    },

    reset: () => initialState,
  },
});

export const {
  receiveSafecoinTokenMap,
  fetchSafecoinTokenMap,
  errorSafecoinTokenMap,
  receiveSolanaTokenMap,
  fetchSolanaTokenMap,
  errorSolanaTokenMap,
  receiveTerraTokenMap,
  fetchTerraTokenMap,
  errorTerraTokenMap,
  reset,
} = tokenSlice.actions;

export default tokenSlice.reducer;
