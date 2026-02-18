import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "sharp",
    "pdfjs-serverless",
    "exceljs",
    "jszip",
    "mammoth",
    "tesseract.js",
  ],
};

export default nextConfig;
