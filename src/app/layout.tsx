import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ReportBug from "./components/ReportBug";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Neural+ Extractor",
  description: "Document ingestion & extraction system for AI pipelines",
  icons: {
    icon: "/neural+_inspiration-removebg-preview.png",
    apple: "/neural+_inspiration-removebg-preview.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        {children}
        <ReportBug />
      </body>
    </html>
  );
}
