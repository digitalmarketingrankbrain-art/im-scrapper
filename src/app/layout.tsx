import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IndiaMart Seller Scraper",
  description: "Extract structured seller and product data from IndiaMART.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>
          <div className="flex min-h-screen flex-col bg-slate-50 sm:flex-row dark:bg-slate-950">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
