declare module "pdf-parse" {
  export interface PDFParseOptions {
    pagerender?: (pageData: unknown) => Promise<string> | string;
    max?: number;
  }

  export interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  }

  export default function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: PDFParseOptions
  ): Promise<PDFParseResult>;
}
