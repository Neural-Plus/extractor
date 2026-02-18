/**
 * Nural+ Extractor — DOCX Extractor
 *
 * Uses `mammoth` to convert DOCX files into semantic HTML, then extracts
 * structured text.  Headings, paragraphs, and lists are preserved.
 */

import mammoth from "mammoth";
import { v4 as uuidv4 } from "uuid";
import type { ChunkType, ContentChunk, ExtractedDocument, Extractor } from "../types";

const SUPPORTED_TYPES = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
];

export class DocxExtractor implements Extractor {
    readonly name = "DocxExtractor";

    supports(mimeType: string): boolean {
        return SUPPORTED_TYPES.includes(mimeType);
    }

    async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
        // Extract both HTML (for structure) and raw text (for fallback)
        const htmlResult = await mammoth.convertToHtml({ buffer });
        const html = htmlResult.value;

        const chunks: ContentChunk[] = [];

        // Parse the HTML into structured chunks
        // mammoth outputs clean HTML with <h1>-<h6>, <p>, <ul>/<ol> tags
        const tagPattern = /<(h[1-6]|p|li|tr)([\s>])([\s\S]*?)<\/\1>/gi;
        let match: RegExpExecArray | null;

        while ((match = tagPattern.exec(html)) !== null) {
            const tag = match[1].toLowerCase();
            const innerHtml = match[3];

            // Strip remaining HTML tags to get plain text
            const text = innerHtml.replace(/<[^>]*>/g, "").trim();

            if (text.length === 0) continue;

            let type: ChunkType = "paragraph";
            if (tag.startsWith("h")) {
                type = "heading";
            } else if (tag === "li") {
                type = "list";
            } else if (tag === "tr") {
                type = "table";
            }

            chunks.push({
                id: "",
                type,
                text,
            });
        }

        // Fallback: if HTML parsing yielded nothing, use raw text extraction
        if (chunks.length === 0) {
            const textResult = await mammoth.extractRawText({ buffer });
            const paragraphs = textResult.value
                .split(/\n{2,}/)
                .map((p) => p.trim())
                .filter((p) => p.length > 0);

            for (const para of paragraphs) {
                chunks.push({
                    id: "",
                    type: "paragraph",
                    text: para,
                });
            }
        }

        return {
            documentId: uuidv4(),
            fileName,
            mimeType: SUPPORTED_TYPES[0],
            metadata: {
                warnings: htmlResult.messages
                    .filter((m) => m.type === "warning")
                    .map((m) => m.message),
            },
            chunks,
        };
    }
}
