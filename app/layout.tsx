import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";


const primaryFont = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kitful",
  description: "Your AI blogging automation suite",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={primaryFont.className}>
        {children}
      </body>
    </html>
  );
}
