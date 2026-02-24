/**
 * Nural+ Extractor — Client-Side PDF OCR
 *
 * Renders specific PDF pages to canvas images in the browser, then runs
 * Tesseract.js OCR entirely client-side.  Designed to be imported only
 * from "use client" components.
 *
 * Key design decisions:
 * - Single Tesseract worker reused across all pages (faster)
 * - Canvas rendering at 2× scale for better OCR accuracy
 * - Graceful per-page error handling
 * - Progress callback for UI feedback
 */

import * as pdfjsLib from "pdfjs-dist";
import { createWorker, Worker } from "tesseract.js";

// Point pdf.js at its own worker bundle served from /public
if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

// ─── Types ────────────────────────────────────────────────────────────

export interface OcrChunk {
    type: "paragraph";
    text: string;
    page: number;
    ocrSource: "client-ocr";
}

export interface OcrProgress {
    /** Current step description */
    status: string;
    /** Which page is being processed (1-indexed) */
    currentPage: number;
    /** Total number of pages to OCR */
    totalPages: number;
    /** 0-100 overall percentage */
    percent: number;
}

export type OcrProgressCallback = (progress: OcrProgress) => void;

// ─── Core ─────────────────────────────────────────────────────────────

/**
 * Run client-side OCR on specific pages of a PDF file.
 *
 * @param file       The original PDF File object (from the user's upload)
 * @param ocrPages   Array of 1-indexed page numbers that need OCR
 * @param onProgress Optional callback for UI progress updates
 * @param lang       Tesseract language code(s), defaults to "eng+fra"
 * @returns          Array of OCR-extracted text chunks with page numbers
 */
export async function ocrPdfPages(
    file: File,
    ocrPages: number[],
    onProgress?: OcrProgressCallback,
    lang = "eng+fra"
): Promise<OcrChunk[]> {
    if (ocrPages.length === 0) return [];

    const chunks: OcrChunk[] = [];

    // ── Step 1: Load PDF in the browser ──
    onProgress?.({
        status: "Loading PDF…",
        currentPage: 0,
        totalPages: ocrPages.length,
        percent: 0,
    });

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

    // ── Step 2: Initialize a single reusable Tesseract worker ──
    onProgress?.({
        status: "Initializing OCR engine…",
        currentPage: 0,
        totalPages: ocrPages.length,
        percent: 5,
    });

    let worker: Worker | null = null;
    try {
        worker = await createWorker(lang, undefined, {
            logger: () => { },
        });

        // ── Step 3: Process each page ──
        for (let i = 0; i < ocrPages.length; i++) {
            const pageNum = ocrPages[i];
            const basePercent = 10 + ((i / ocrPages.length) * 85);

            onProgress?.({
                status: `Rendering page ${pageNum}…`,
                currentPage: i + 1,
                totalPages: ocrPages.length,
                percent: Math.round(basePercent),
            });

            try {
                // Render page to canvas
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2.0 }); // 2× for OCR accuracy

                const canvas = document.createElement("canvas");
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    console.error(`[pdf-ocr-client] Cannot get 2d context for page ${pageNum}`);
                    continue;
                }

                await page.render({ canvasContext: ctx, viewport, canvas }).promise;

                onProgress?.({
                    status: `OCR scanning page ${pageNum}…`,
                    currentPage: i + 1,
                    totalPages: ocrPages.length,
                    percent: Math.round(basePercent + 40 / ocrPages.length),
                });

                // Convert canvas to blob → buffer for Tesseract
                const blob = await new Promise<Blob | null>((resolve) =>
                    canvas.toBlob(resolve, "image/png")
                );

                if (!blob) {
                    console.error(`[pdf-ocr-client] Canvas toBlob failed for page ${pageNum}`);
                    continue;
                }

                // Run OCR
                const { data: { text } } = await worker.recognize(blob);

                const trimmedText = text.trim();
                if (trimmedText.length > 0) {
                    chunks.push({
                        type: "paragraph",
                        text: trimmedText,
                        page: pageNum,
                        ocrSource: "client-ocr",
                    });
                }
            } catch (err) {
                console.error(`[pdf-ocr-client] OCR failed for page ${pageNum}:`, err);
                // Continue with next page
            }
        }

        onProgress?.({
            status: "OCR complete ✓",
            currentPage: ocrPages.length,
            totalPages: ocrPages.length,
            percent: 100,
        });
    } finally {
        // Always terminate the worker to free memory
        if (worker) {
            try {
                await worker.terminate();
            } catch {
                // Swallow termination errors
            }
        }
    }

    return chunks;
}
