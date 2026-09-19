"use client";

import { Space_Grotesk, Work_Sans } from "next/font/google";
import "./globals.css";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./lib/wagmi";

const queryClient = new QueryClient();

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const workSans = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* MANTENHA a sua tag <meta name="talentapp:project_verification" ...>
            original aqui — eu não tinha o valor completo no print pra copiar sem risco de errar. */}
      </head>
      <body
        suppressHydrationWarning
        className={`${spaceGrotesk.variable} ${workSans.variable} antialiased`}
      >
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}