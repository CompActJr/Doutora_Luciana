import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: "Dra. Luciana — Painel",
  description: "Painel de gestão da assistente da clínica.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR" className={jakarta.variable}><body>{children}</body></html>;
}
