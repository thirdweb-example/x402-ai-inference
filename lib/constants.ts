import { arbitrum } from "thirdweb/chains";
import { getDefaultToken } from "thirdweb/react";

export const PRICE_PER_INFERENCE_TOKEN_WEI = 1; // 0.000001 USDC
export const MAX_INFERENCE_TOKENS_PER_CALL = 100000; // 100k inference tokens per query max
export const MIN_REMAINING_ALLOWANCE_WEI = 95000; // 5000 wei minimum allowance allowed equivalent to 0.095 USDC.

export const paymentChain = arbitrum;
export const paymentToken = getDefaultToken(paymentChain, "USDC")!;