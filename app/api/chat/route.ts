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
import { MAX_INFERENCE_TOKENS_PER_CALL, paymentToken, PRICE_PER_INFERENCE_TOKEN_WEI } from "../../../lib/constants";

const twFacilitator = facilitator({
  client: serverClient,
  serverWalletAddress,
});

const asset = {
  address: paymentToken.address as `0x${string}`,
};

// In-memory cache for session payment data
// Maps sessionId to payment data string
const paymentCache = new Map<string, string>();

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

  // Check if we have cached payment data for this session
  let paymentData: string | null = null;
  
  if (sessionId && paymentCache.has(sessionId)) {
    // Use cached payment data for existing session
    paymentData = paymentCache.get(sessionId)!;
    console.log(`Using cached payment data for session: ${sessionId}`);
  } else {
    // New session or no sessionId - get payment from header
    paymentData = request.headers.get("x-payment");
    
    // Cache the payment data if we have a sessionId
    if (sessionId && paymentData) {
      paymentCache.set(sessionId, paymentData);
      console.log(`Cached payment data for new session: ${sessionId}`);
    }
  }

  const paymentArgs: PaymentArgs = {
    facilitator: twFacilitator,
    method: "POST",
    network: arbitrum,
    scheme: "upto",
    routeConfig: {
      maxTimeoutSeconds: 86400, // 24 hours in seconds 
    },
    price: {
      amount: (PRICE_PER_INFERENCE_TOKEN_WEI * MAX_INFERENCE_TOKENS_PER_CALL).toString(),
      asset,
    },
    resourceUrl: request.url,
    paymentData,
  }

  // verify the signed payment data with maximum payment amount before doing any work
  const result = await verifyPayment(paymentArgs);

  if (result.status !== 200) {
    return Response.json(result.responseBody, {
      status: result.status,
      headers: result.responseHeaders,
    });
  }

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

      // finally, settle the payment asynchronously after the stream is completed
      try {
        const result = await settlePayment({
          ...paymentArgs,
          price: {
            amount: finalPrice.toString(),
            asset,
          },
        });
        console.log(`Payment result: ${JSON.stringify(result)}`);
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
