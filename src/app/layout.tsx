import type { Metadata } from "next";
import { Cabin, Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";

// The two families latticelane.com uses: Cabin for headings, Figtree for body.
const cabin = Cabin({ variable: "--font-cabin", subsets: ["latin"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

// Kept for product and document codes, where fixed-width digits matter.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lattice Lane",
  description: "Hamper costing and quotation builder",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${cabin.variable} ${figtree.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-figtree)]">
        {children}
      </body>
    </html>
  );
}
