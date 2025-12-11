"use client";

import cn from "classnames";
import { toast } from "sonner";
import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useMemo } from "react";
import { Messages } from "./messages";
import { modelID, models } from "@/lib/models";
import { Footnote } from "./footnote";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  StopIcon,
  TrashIcon,
} from "./icons";
import { Input } from "./input";
import { DefaultChatTransport } from "ai";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { useActiveWallet } from "thirdweb/react";
import { client } from "../lib/thirdweb.client";
import { Wallet } from "thirdweb/wallets";
import { SignInButton } from "./sign-in-button";

export function Chat() {
  const wallet = useActiveWallet();
  if (!wallet) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center h-dvh">
        <h3 className="text-2xl font-bold">Sign in to continue</h3>
        <SignInButton />
      </div>
    );
  }
  return <ChatInner wallet={wallet} />;
}

function ChatInner(props: { wallet: Wallet }) {
  const [input, setInput] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<modelID>("gpt-5.1");
  const [sessionId, setSessionId] = useState<string>("");

  // Generate session ID on client side only to avoid hydration issues
  useEffect(() => {
    if (!sessionId) {
      setSessionId(crypto.randomUUID());
    }
  }, [sessionId]);

  // Memoize fetchWithPayment and transport to avoid recreating on every render
  const transport = useMemo(() => {
    const fetchWithPayment = wrapFetchWithPayment(
      fetch,
      client,
      props.wallet
    ) as typeof globalThis.fetch;
    
    return new DefaultChatTransport({
      fetch: fetchWithPayment,
    });
  }, [props.wallet]);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: sessionId || "initializing",
    transport,
    onError: (error) => {
      try {
        const errorData = JSON.parse(error.message);
        if (errorData.error === "insufficient_funds" && errorData.fundWalletLink) {
          const topUpUrl = errorData.fundWalletLink;
          toast.info("Insufficient funds", {
            description: "Top up your wallet to continue",
            action: {
              label: "Top Up",
              onClick: () => window.open(topUpUrl, "_blank"),
            },
            duration: 10000, // Show for 10 seconds
          });
        } else {
          toast.error(`An error occurred: ${errorData.errorMessage}`);
        }
      } catch {
        toast.error(`An error occurred: ${error.message}`);
      }
    },
  });

  const isGeneratingResponse = ["streaming", "submitted"].includes(status);

  const handleClearChat = () => {
    setMessages([]);
    setSessionId(crypto.randomUUID());
    setInput("");
  };

  return (
    <div
      className={cn(
        "px-4 md:px-0 pb-4 pt-8 flex flex-col h-dvh items-center w-full max-w-3xl",
        {
          "justify-between": messages.length > 0,
          "justify-center gap-4": messages.length === 0,
        }
      )}
    >
      {messages.length > 0 ? (
        <Messages messages={messages} status={status} />
      ) : (
        <div className="flex flex-col gap-0.5 sm:text-2xl text-xl w-full">
          <div className="flex flex-row gap-2 items-center">
            <div>Pay as you go for AI inference.</div>
          </div>
          <div className="dark:text-zinc-500 text-zinc-400 text-sm">
            Only pay for the tokens you use, no subscription or API key
            required.
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 w-full">
        <div className="flex relative flex-col gap-1 p-3 w-full rounded-2xl dark:bg-zinc-800 bg-zinc-100">
          <Input
            input={input}
            setInput={setInput}
            selectedModelId={selectedModelId}
            isGeneratingResponse={isGeneratingResponse}
            isReasoningEnabled={true}
            onSubmit={() => {
              if (input === "" || !sessionId) {
                return;
              }
              sendMessage(
                { text: input },
                {
                  body: {
                    selectedModelId,
                    sessionId,
                  },
                }
              );
              setInput("");
            }}
          />

          <div className="absolute bottom-2.5 right-2.5 flex flex-row gap-2">
            {messages.length > 0 && (
              <button
                className="text-sm p-1.5 rounded-lg flex flex-row items-center gap-1 dark:hover:bg-zinc-700 hover:bg-zinc-200 cursor-pointer text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                onClick={handleClearChat}
                title="Clear chat"
              >
                <TrashIcon size={14} />
                <span className="text-xs">Clear</span>
              </button>
            )}
            <div className="relative w-fit text-sm p-1.5 rounded-lg flex flex-row items-center gap-0.5 dark:hover:bg-zinc-700 hover:bg-zinc-200 cursor-pointer">
              {/* <div>
                {selectedModel ? selectedModel.name : "Models Unavailable!"}
              </div> */}
              <div className="flex justify-center items-center px-1 text-zinc-500 dark:text-zinc-400">
                <span className="pr-1">{models[selectedModelId]}</span>
                <ChevronDownIcon />
              </div>

              <select
                className="absolute left-0 p-1 w-full opacity-0 cursor-pointer"
                value={selectedModelId}
                onChange={(event) => {
                  setSelectedModelId(event.target.value as modelID);
                }}
              >
                {Object.entries(models).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className={cn(
                "size-8 flex flex-row justify-center items-center dark:bg-zinc-100 bg-zinc-900 dark:text-zinc-900 text-zinc-100 p-1.5 rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-300 hover:scale-105 active:scale-95 transition-all",
                {
                  "dark:bg-zinc-200 dark:text-zinc-500":
                    isGeneratingResponse || input === "" || !sessionId,
                }
              )}
              onClick={() => {
                if (input === "" || !sessionId) {
                  return;
                }

                if (isGeneratingResponse) {
                  stop();
                } else {
                  sendMessage(
                    { text: input },
                    {
                      body: {
                        selectedModelId,
                        sessionId,
                      },
                    }
                  );
                }

                setInput("");
              }}
            >
              {isGeneratingResponse ? <StopIcon /> : <ArrowUpIcon />}
            </button>
          </div>
        </div>

        <Footnote />
      </div>
    </div>
  );
}
