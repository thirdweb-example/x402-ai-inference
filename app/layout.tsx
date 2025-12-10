import { Toaster } from "sonner";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Link from "next/link";
import type { Metadata } from "next";

import "./globals.css";
import { StarButton } from "@/components/star-button";
import { ThirdwebProvider } from "thirdweb/react";
import { SignInButton } from "../components/sign-in-button";
import Image from "next/image";

export const metadata: Metadata = {
  title: "thirdwebx402 AI Inference",
  description:
    "This is a preview of using x402 AI Inference with Next.js and the AI SDK.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThirdwebProvider>
      <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <body>
          <div className="fixed right-0 left-0 w-full top-0 bg-white dark:bg-zinc-950 mx-auto">
            <div className="flex justify-between items-center p-4">
              <div className="flex flex-row items-center gap-2 shrink-0 ">
                <span className="jsx-e3e12cc6f9ad5a71 flex flex-row items-center gap-2 home-links">
                  <Link
                    className="text-zinc-800 dark:text-zinc-100 -translate-y-[.5px]"
                    rel="noopener"
                    target="_blank"
                    href="https://thirdweb.com/"
                  >
                    <Image src="/thirdweb.png" alt="Thirdweb Logo" width={48} height={48} />
                  </Link>
                  <h3 className="text-xl font-bold">thirdweb</h3>
                </span>
              </div>
              <div className="flex flex-row items-center gap-4 shrink-0">
                <StarButton />
                <SignInButton />
              </div>
            </div>
          </div>
          <Toaster position="top-center" />
          {children}
        </body>
      </html>
    </ThirdwebProvider>
  );
}
