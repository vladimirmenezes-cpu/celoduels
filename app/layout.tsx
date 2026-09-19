"use client";

import { Rajdhani, Manrope } from "next/font/google";
import "./globals.css";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./lib/wagmi";

const queryClient = new QueryClient();

const rajdhani = Rajdhani({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {<meta name="talentapp:project_verification" content="a4c493933a3e827a06c621863cd0a3c9956d223ab5b4653bfa35b802cc5df20ee12fce832f15905e9c7f618a083ea072e4fa57a39229719504594635301145c7" />}
      </head>
      <body
        suppressHydrationWarning
        className={`${rajdhani.variable} ${manrope.variable} antialiased`}
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