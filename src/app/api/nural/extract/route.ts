/**
 * Nural+ Extractor — API Route
 *
 * POST /api/nural/extract
 *
 * Accepts multipart/form-data uploads with one or more files under the
 * field name "files".  Each file is routed to the appropriate extractor,
 * processed in parallel, and the results are returned as JSON.
 *
 * Limits:
 * - Maximum file size: 50 MB per file
 * - Graceful per-file error handling (one failure doesn't crash the batch)
 */

import { NextRequest, NextResponse } from "next/server";
import { ExtractorRouter } from "@/lib/nural-extractor";
import type { ExtractionResult, ExtractionResponse } from "@/lib/nural-extractor";

/**
 * Next.js Route Segment Config
 * Allow up to 60s execution for large file processing.
 */
export const maxDuration = 60;

/** 50 MB in bytes */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Singleton router instance (reused across requests) */
const router = new ExtractorRouter();

/**
 * Map common file extensions to MIME types as a fallback when the browser
 * sends a generic `application/octet-stream` content type.
 */
const EXTENSION_MIME_MAP: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".csv": "text/csv",
    ".tsv": "text/tab-separated-values",
    ".pptx":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".html": "text/html",
    ".htm": "text/html",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".tiff": "image/tiff",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
};

/**
 * Resolve the effective MIME type for a file.
 * Falls back to extension-based detection when the browser sends a
 * generic content-type.
 */
function resolveMimeType(file: File): string {
    const browserType = file.type?.toLowerCase();

    // If the browser provided a specific type, use it
    if (browserType && browserType !== "application/octet-stream") {
        return browserType;
    }

    // Fall back to extension mapping
    const ext = file.name
        .slice(file.name.lastIndexOf("."))
        .toLowerCase();

    return EXTENSION_MIME_MAP[ext] ?? browserType ?? "application/octet-stream";
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
    try {
        // ── Validate content type ──
        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.includes("multipart/form-data")) {
            return NextResponse.json(
                { error: "Invalid content type. Expected multipart/form-data." },
                { status: 415 }
            );
        }

        // ── Parse multipart form data ──
        const formData = await request.formData();
        const files = formData.getAll("files");

        if (files.length === 0) {
            return NextResponse.json(
                { error: "No files provided. Upload files using the 'files' form field." },
                { status: 400 }
            );
        }

        // ── Validate & process each file concurrently ──
        const promises = files.map(async (entry): Promise<ExtractionResult> => {
            // Ensure the entry is actually a File (not a string field)
            if (!(entry instanceof File)) {
                return {
                    success: false,
                    fileName: "(non-file field)",
                    error: "Expected a file upload, received a string field.",
                };
            }

            const fileName = entry.name || "unnamed";

            try {
                // ── Size validation ──
                if (entry.size > MAX_FILE_SIZE) {
                    return {
                        success: false,
                        fileName,
                        error: `File exceeds the 50 MB limit (${(entry.size / 1024 / 1024).toFixed(1)} MB).`,
                    };
                }

                if (entry.size === 0) {
                    return {
                        success: false,
                        fileName,
                        error: "File is empty.",
                    };
                }

                // ── Resolve MIME type ──
                const mimeType = resolveMimeType(entry);

                // ── Read buffer ──
                const arrayBuffer = await entry.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                // ── Extract & normalize ──
                const document = await router.process(buffer, fileName, mimeType);

                return { success: true, document };
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : "Unknown extraction error";
                return { success: false, fileName, error: message };
            }
        });

        // Use allSettled so one rejection never crashes the batch
        const settled = await Promise.allSettled(promises);

        const results: ExtractionResult[] = settled.map((outcome) => {
            if (outcome.status === "fulfilled") {
                return outcome.value;
            }
            return {
                success: false as const,
                fileName: "unknown",
                error: outcome.reason?.message ?? "Unhandled extraction failure",
            };
        });

        const response: ExtractionResponse = { results };

        return NextResponse.json(response, { status: 200 });
    } catch (err: unknown) {
        const message =
            err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// Reject non-POST methods
// ---------------------------------------------------------------------------

export async function GET() {
    return NextResponse.json(
        {
            error: "Method not allowed. Use POST with multipart/form-data.",
            usage: {
                method: "POST",
                path: "/api/nural/extract",
                body: "multipart/form-data with field 'files'",
                supportedTypes: Object.values(EXTENSION_MIME_MAP).filter(
                    (v, i, a) => a.indexOf(v) === i
                ),
            },
        },
        { status: 405 }
    );
}
