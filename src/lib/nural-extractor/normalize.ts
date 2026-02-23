/**
 * Nural+ Extractor — Normalization Engine
 *
 * Cleans, deduplicates, and standardizes extracted content chunks so that
 * downstream LLM consumers receive consistent, high-quality text regardless
 * of the source document format.
 */

import { v4 as uuidv4 } from "uuid";
import type { ContentChunk, ExtractedDocument } from "./types";

// ---------------------------------------------------------------------------
// Text-level normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a raw text string:
 * 1. Replace non-breaking spaces / zero-width chars with regular space
 * 2. Merge broken lines (single newlines become spaces)
 * 3. Collapse consecutive whitespace into a single space
 * 4. Trim leading / trailing whitespace
 * 5. Remove common extraction artifacts (e.g. form-feed, null bytes)
 */
export function normalizeText(raw: string): string {
    return raw
        // Remove null bytes and form-feeds
        .replace(/[\x00\x0C]/g, "")
        // Replace non-breaking spaces and zero-width characters
        .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, " ")
        // Merge single line-breaks into spaces (preserve paragraph breaks)
        .replace(/([^\n])\n([^\n])/g, "$1 $2")
        // Collapse multiple blank lines into a single blank line
        .replace(/\n{3,}/g, "\n\n")
        // Collapse horizontal whitespace runs
        .replace(/[ \t]+/g, " ")
        // Trim each line
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        // Final outer trim
        .trim();
}

// ---------------------------------------------------------------------------
// Chunk-level normalization
// ---------------------------------------------------------------------------

/**
 * Normalize an array of content chunks:
 * - Apply `normalizeText` to each chunk's text
 * - Filter out empty chunks
 * - Assign sequential UUIDs
 */
export function normalizeChunks(chunks: ContentChunk[]): ContentChunk[] {
    return chunks
        .map((chunk) => ({
            ...chunk,
            text: normalizeText(chunk.text),
        }))
        .filter((chunk) => chunk.text.length > 0)
        .map((chunk) => ({
            ...chunk,
            id: uuidv4(),
        }));
}

// ---------------------------------------------------------------------------
// Document-level normalization
// ---------------------------------------------------------------------------

/**
 * Normalize an entire extracted document.
 * Apply chunk normalization and ensure a stable documentId.
 */
export function normalizeDocument(doc: ExtractedDocument): ExtractedDocument {
    return {
        ...doc,
        documentId: doc.documentId || uuidv4(),
        chunks: normalizeChunks(doc.chunks),
    };
}
