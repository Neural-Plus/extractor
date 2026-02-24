/**
 * Nural+ Extractor — PDF Extractor
 *
 * Uses `pdfjs-serverless` to parse PDF documents and extract text
 * content on a per-page basis.  Each page produces one or more chunks
 * with page numbers attached.
 */

import { getDocument } from "pdfjs-serverless";
import { v4 as uuidv4 } from "uuid";
import type { ContentChunk, ExtractedDocument, Extractor } from "../types";

const SUPPORTED_TYPES = [
    "application/pdf",
];

export class PdfExtractor implements Extractor {
    readonly name = "PdfExtractor";

    supports(mimeType: string): boolean {
        return SUPPORTED_TYPES.includes(mimeType);
    }

    /**
     * Minimum characters of extracted text for a page to be considered
     * "text-rich".  Pages below this threshold are flagged for client-side
     * OCR (they are likely scanned images or nearly-blank pages).
     */
    private static readonly MIN_TEXT_LENGTH = 50;

    async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
        // pdfjs-serverless expects { data: Uint8Array } and returns a loading task
        const data = new Uint8Array(buffer);
        const pdf = await getDocument({ data, useSystemFonts: true }).promise;

        const chunks: ContentChunk[] = [];
        const totalPages = pdf.numPages;
        const ocrPages: number[] = [];

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            // Concatenate all text items on the page
            const pageText = textContent.items
                .filter((item: Record<string, unknown>) => "str" in item)
                .map((item: Record<string, unknown>) => item.str as string)
                .join(" ");

            const trimmed = pageText.trim();

            // ── Sparse / empty page detection ──
            if (trimmed.length < PdfExtractor.MIN_TEXT_LENGTH) {
                ocrPages.push(pageNum);
                // Still include whatever little text we found (if any)
                if (trimmed.length > 0) {
                    chunks.push({
                        id: "",
                        type: "paragraph",
                        text: trimmed,
                        page: pageNum,
                    });
                }
                continue;
            }

            // ── Normal text-rich page ──
            // Split into paragraphs based on double newlines or significant gaps
            const paragraphs = pageText
                .split(/\n{2,}/)
                .map((p) => p.trim())
                .filter((p) => p.length > 0);

            if (paragraphs.length === 0) {
                // Treat entire page text as a single paragraph
                chunks.push({
                    id: "",
                    type: "paragraph",
                    text: pageText,
                    page: pageNum,
                });
            } else {
                for (const para of paragraphs) {
                    // Simple heuristic: short all-caps lines are likely headings
                    const isHeading =
                        para.length < 120 &&
                        para === para.toUpperCase() &&
                        !/\d{4,}/.test(para);

                    chunks.push({
                        id: "",
                        type: isHeading ? "heading" : "paragraph",
                        text: para,
                        page: pageNum,
                    });
                }
            }
        }

        return {
            documentId: uuidv4(),
            fileName,
            mimeType: "application/pdf",
            metadata: {
                pageCount: totalPages,
                ocrPages,
                isScannedPdf: ocrPages.length === totalPages && totalPages > 0,
            },
            chunks,
        };
    }
}
