/**
 * Nural+ Extractor — HTML Extractor
 *
 * Strips scripts, styles, and tags from raw HTML to produce clean text.
 * Pure regex-based — no external HTML parser dependency required.
 */

import { v4 as uuidv4 } from "uuid";
import type { ContentChunk, ExtractedDocument, Extractor } from "../types";

const SUPPORTED_TYPES = [
    "text/html",
    "application/xhtml+xml",
];

export class HtmlExtractor implements Extractor {
    readonly name = "HtmlExtractor";

    supports(mimeType: string): boolean {
        return SUPPORTED_TYPES.includes(mimeType);
    }

    async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
        let html = buffer.toString("utf-8");

        // ── Step 1: Extract metadata from <title> ──
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : undefined;

        // ── Step 2: Remove elements that carry no readable content ──
        html = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
            .replace(/<svg[\s\S]*?<\/svg>/gi, "")
            .replace(/<!--[\s\S]*?-->/g, "");

        // ── Step 3: Convert structural tags into newlines ──
        html = html
            .replace(/<\/?(p|div|br|hr|section|article|header|footer|main|nav|aside|blockquote|pre|table|tr|ul|ol|dl|dt|dd|figcaption|figure)[^>]*>/gi, "\n")
            .replace(/<\/?(h[1-6])[^>]*>/gi, "\n");

        // ── Step 4: Strip remaining tags ──
        html = html.replace(/<[^>]*>/g, " ");

        // ── Step 5: Decode common HTML entities ──
        html = html
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, " ");

        // ── Step 6: Split into paragraphs ──
        const paragraphs = html
            .split(/\n{2,}/)
            .map((p) => p.replace(/\s+/g, " ").trim())
            .filter((p) => p.length > 0);

        const chunks: ContentChunk[] = paragraphs.map((text) => ({
            id: "",
            type: "paragraph" as const,
            text,
        }));

        return {
            documentId: uuidv4(),
            fileName,
            mimeType: "text/html",
            metadata: {
                ...(title ? { title } : {}),
            },
            chunks,
        };
    }
}
