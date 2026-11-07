import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import { fr } from "@/i18n/fr";
import "./globals.css";

const heading = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: fr.appName,
  description: fr.tagline,
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1512" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Render per request so Next.js can attach the CSP nonce from src/proxy.ts.
  await connection();
  return (
    <html lang="fr" dir="ltr" className={`h-full antialiased ${heading.variable} ${body.variable}`}>
      <body className="flex min-h-full flex-col">
        <AppNav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 md:pt-8 md:pb-12">
          {children}
        </main>
      </body>
    </html>
  );
}
