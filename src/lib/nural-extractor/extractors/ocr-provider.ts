/**
 * Nural+ Extractor — Tesseract OCR Provider
 *
 * Implements the `OcrProvider` interface using Tesseract.js for
 * real text recognition from images, entirely in Node.js.
 */

import Tesseract from "tesseract.js";
import type { OcrProvider } from "../types";

export class TesseractOcrProvider implements OcrProvider {
    private lang: string;

    /**
     * @param lang  Tesseract language code(s), e.g. "eng", "fra", "eng+fra"
     */
    constructor(lang = "eng") {
        this.lang = lang;
    }

    async recognize(imageBuffer: Buffer): Promise<string> {
        const {
            data: { text },
        } = await Tesseract.recognize(imageBuffer, this.lang, {
            logger: () => { }, // silence progress logs
        });

        return text.trim();
    }
}
