import { modelID, myProvider } from "@/lib/models";
import {
  convertToModelMessages,
  smoothStream,
  streamText,
  UIMessage,
} from "ai";
import { NextRequest } from "next/server";
import { settlePayment, facilitator, verifyPayment, PaymentArgs } from "thirdweb/x402";
import { arbitrum } from "thirdweb/chains";
import {
  serverClient,
  serverWalletAddress,
} from "../../../lib/thirdweb.server";
import { MAX_INFERENCE_TOKENS_PER_CALL, MIN_REMAINING_ALLOWANCE_WEI, paymentToken, PRICE_PER_INFERENCE_TOKEN_WEI } from "../../../lib/constants";

const twFacilitator = facilitator({
  client: serverClient,
  serverWalletAddress,
});

const asset = {
  address: paymentToken.address as `0x${string}`,
};

// COMMENTED OUT: In-memory cache for session payment data
// const paymentCache = new Map<string, string>();

export async function POST(request: NextRequest) {
  // Parse request body to extract sessionId and other data
  const {
    messages,
    selectedModelId,
    sessionId,
  }: {
    messages: Array<UIMessage>;
    selectedModelId: modelID;
    sessionId?: string;
  } = await request.json();

  // COMMENTED OUT: Payment cache logic - always reading from header for testing
  // let paymentData: string | null = null;
  // if (sessionId && paymentCache.has(sessionId)) {
  //   paymentData = paymentCache.get(sessionId)!;
  //   console.log(`Using cached payment data for session: ${sessionId}`);
  // } else {
  //   paymentData = request.headers.get("x-payment");
  //   if (sessionId && paymentData) {
  //     paymentCache.set(sessionId, paymentData);
  //     console.log(`Cached payment data for new session: ${sessionId}`);
  //   }
  // }

  // Always get payment data from header
  const paymentData = request.headers.get("x-payment");

  const verifyPaymentArgs: PaymentArgs = {
    facilitator: twFacilitator,
    method: "POST",
    network: arbitrum,
    scheme: "upto",
    routeConfig: {
      maxTimeoutSeconds: 86400, // the payment signature is valid for 24 hours in seconds 
    },
    price: {
      amount: (PRICE_PER_INFERENCE_TOKEN_WEI * MAX_INFERENCE_TOKENS_PER_CALL).toString(),  // equivalent to 0.1 USDC
      asset,
    },
    minPrice: {
      amount: MIN_REMAINING_ALLOWANCE_WEI.toString(),  // minimum allowance limit before asking for new payment signature equivalent to 0.095 USDC
      asset,
    },
    resourceUrl: request.url,
    paymentData,
  }

  // verify the signed payment data with maximum payment amount before doing any work
  const result = await verifyPayment(verifyPaymentArgs);

  if (result.status !== 200) {
    return Response.json(result.responseBody, {
      status: result.status,
      headers: result.responseHeaders,
    });
  }

 // console.log(`Payment allowance after verifyPayment: ${JSON.stringify(result)}`);

  // then, process the chat request and do the inference
  const stream = streamText({
    system: "You are a helpful assistant.",
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 12000 },
      },
      openai: {
        thinking: { type: "enabled", budgetTokens: 12000 },
      },
    },
    model: myProvider.languageModel(selectedModelId),
    experimental_transform: [
      smoothStream({
        chunking: "word",
      }),
    ],
    messages: convertToModelMessages(messages),
    onFinish: async (event) => {
      const totalTokens = event.totalUsage.totalTokens;

      if (!totalTokens) {
        console.error("Token usage data not available");
        return;
      }

      const finalPrice = PRICE_PER_INFERENCE_TOKEN_WEI * totalTokens;

      const settlePaymentArgs: PaymentArgs = {
        facilitator: twFacilitator,
        method: "POST",
        network: arbitrum,
        scheme: "upto",
        routeConfig: {
          maxTimeoutSeconds: 86400, // 24 hours in seconds 
        },
        price: {
          amount:finalPrice.toString(),  // actual price of the inference tokens used
          asset,
        },
        resourceUrl: request.url,
        paymentData,
      }

      // finally, settle the payment asynchronously after the stream is completed
      try {
        const settleResult = await settlePayment({
          ...settlePaymentArgs
        });
        console.log(`Payment result after settlePayment: ${JSON.stringify(settleResult)}`);
      } catch (error) {
        console.error("Payment settlement failed:", error);
      }
    },
  });

  return stream.toUIMessageStreamResponse({
    sendReasoning: true,
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') {
        return {
          totalTokens: part.totalUsage.totalTokens,
        };
      }
      return undefined;
    },
    onError: () => {
      return `An error occurred, please try again!`;
    },
  });
}
