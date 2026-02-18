/**
 * Nural+ Extractor — Extractor Router
 *
 * Central registry that matches incoming files to the correct extractor
 * based on MIME type, then runs extraction + normalization.
 *
 * Pre-registers all built-in extractors on construction.
 */

import { CsvExtractor } from "./extractors/csv";
import { DocxExtractor } from "./extractors/docx";
import { ExcelExtractor } from "./extractors/excel";
import { HtmlExtractor } from "./extractors/html";
import { ImageExtractor } from "./extractors/image";
import { TesseractOcrProvider } from "./extractors/ocr-provider";
import { PdfExtractor } from "./extractors/pdf";
import { PptxExtractor } from "./extractors/pptx";
import { normalizeDocument } from "./normalize";
import type { ExtractedDocument, Extractor } from "./types";

// Built-in extractors

export class ExtractorRouter {
    private readonly extractors: Extractor[] = [];

    constructor() {
        // Register built-in extractors in priority order
        this.register(new PdfExtractor());
        this.register(new DocxExtractor());
        this.register(new ExcelExtractor());
        this.register(new CsvExtractor());
        this.register(new PptxExtractor());
        this.register(new HtmlExtractor());
        // Image extractor with Tesseract.js OCR enabled
        const imageExtractor = new ImageExtractor();
        imageExtractor.setOcrProvider(new TesseractOcrProvider());
        this.register(imageExtractor);
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /** Add a custom extractor to the registry */
    register(extractor: Extractor): void {
        this.extractors.push(extractor);
    }

    /**
     * Find the first extractor that supports the given MIME type.
     * @throws if no extractor is registered for the type
     */
    route(mimeType: string): Extractor {
        const extractor = this.extractors.find((e) => e.supports(mimeType));
        if (!extractor) {
            throw new Error(`No extractor registered for MIME type: ${mimeType}`);
        }
        return extractor;
    }

    /**
     * End-to-end pipeline: route → extract → normalize.
     *
     * @param buffer  Raw file bytes
     * @param fileName  Original file name
     * @param mimeType  Detected MIME type
     * @returns Normalized `ExtractedDocument`
     */
    async process(
        buffer: Buffer,
        fileName: string,
        mimeType: string
    ): Promise<ExtractedDocument> {
        const extractor = this.route(mimeType);
        const raw = await extractor.extract(buffer, fileName);
        return normalizeDocument({ ...raw, mimeType });
    }
}
