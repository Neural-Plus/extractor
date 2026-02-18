/**
 * Nural+ Extractor — Image Extractor
 *
 * Uses `sharp` to read image metadata (dimensions, format, colour space).
 * Provides a pluggable `OcrProvider` interface for future OCR integration.
 *
 * Without an OCR provider, the extractor returns image metadata and a
 * placeholder text chunk indicating that OCR is pending.
 */

import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import type {
    ContentChunk,
    ExtractedDocument,
    Extractor,
    OcrProvider,
} from "../types";

const SUPPORTED_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/tiff",
    "image/gif",
    "image/bmp",
];

export class ImageExtractor implements Extractor {
    readonly name = "ImageExtractor";

    /**
     * Optional OCR provider.  When set, the extractor will preprocess the
     * image with `sharp` and then delegate text recognition to the provider.
     */
    private ocrProvider: OcrProvider | null = null;

    /** Inject an OCR provider for real text extraction */
    setOcrProvider(provider: OcrProvider): void {
        this.ocrProvider = provider;
    }

    supports(mimeType: string): boolean {
        return SUPPORTED_TYPES.includes(mimeType);
    }

    async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
        const image = sharp(buffer);
        const metadata = await image.metadata();

        const chunks: ContentChunk[] = [];

        // ── OCR path ──
        if (this.ocrProvider) {
            // Preprocess: convert to greyscale PNG for better OCR accuracy
            const preprocessed = await image
                .greyscale()
                .normalize()
                .png()
                .toBuffer();

            const recognizedText = await this.ocrProvider.recognize(preprocessed);

            if (recognizedText.trim().length > 0) {
                chunks.push({
                    id: "",
                    type: "paragraph",
                    text: recognizedText,
                });
            }
        } else {
            // No OCR provider — return a placeholder
            chunks.push({
                id: "",
                type: "paragraph",
                text: `[Image: ${fileName}] — OCR not configured. Provide an OcrProvider to extract text from images.`,
            });
        }

        return {
            documentId: uuidv4(),
            fileName,
            mimeType: metadata.format ? `image/${metadata.format}` : "image/unknown",
            metadata: {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                space: metadata.space,
                channels: metadata.channels,
                hasAlpha: metadata.hasAlpha,
                density: metadata.density,
                ocrEnabled: !!this.ocrProvider,
            },
            chunks,
        };
    }
}
