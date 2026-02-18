/**
 * Nural+ Extractor — PPTX Extractor
 *
 * Uses `jszip` to open .pptx archives and extract text from each slide's
 * XML content.  Produces one chunk per slide.
 */

import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import type { ContentChunk, ExtractedDocument, Extractor } from "../types";

const SUPPORTED_TYPES = [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
];

export class PptxExtractor implements Extractor {
    readonly name = "PptxExtractor";

    supports(mimeType: string): boolean {
        return SUPPORTED_TYPES.includes(mimeType);
    }

    async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
        const zip = await JSZip.loadAsync(buffer);

        // Collect slide entries sorted numerically (slide1.xml, slide2.xml, …)
        const slideEntries = Object.keys(zip.files)
            .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
            .sort((a, b) => {
                const numA = parseInt(a.match(/slide(\d+)/i)?.[1] ?? "0", 10);
                const numB = parseInt(b.match(/slide(\d+)/i)?.[1] ?? "0", 10);
                return numA - numB;
            });

        const chunks: ContentChunk[] = [];

        for (let i = 0; i < slideEntries.length; i++) {
            const entry = slideEntries[i];
            const xml = await zip.files[entry].async("text");

            // Extract all text inside <a:t> tags (the standard OOXML text element)
            const textParts: string[] = [];
            const tagPattern = /<a:t[^>]*>([\s\S]*?)<\/a:t>/gi;
            let match: RegExpExecArray | null;

            while ((match = tagPattern.exec(xml)) !== null) {
                const text = match[1].trim();
                if (text.length > 0) {
                    textParts.push(text);
                }
            }

            const slideText = textParts.join(" ");
            if (slideText.trim().length > 0) {
                chunks.push({
                    id: "",
                    type: "paragraph",
                    text: slideText,
                    page: i + 1,
                    section: `Slide ${i + 1}`,
                });
            }
        }

        return {
            documentId: uuidv4(),
            fileName,
            mimeType: SUPPORTED_TYPES[0],
            metadata: {
                slideCount: slideEntries.length,
            },
            chunks,
        };
    }
}
