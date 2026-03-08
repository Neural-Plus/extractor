/**
 * Nural+ Extractor — Public API v1
 *
 * POST /api/v1/extract
 *
 * Public-facing versioned endpoint for document extraction.
 * Accepts multipart/form-data with one or more files under the "files" field.
 * Each file is routed to the appropriate extractor, processed in parallel,
 * and the structured results are returned as JSON.
 *
 * Features:
 * - Batch uploads (multiple files in one request)
 * - Per-file error isolation (one failure doesn't crash the batch)
 * - Automatic MIME type detection with extension fallback
 * - 50 MB per-file size limit
 * - 60s max execution time
 *
 * Response format:
 * {
 *   "apiVersion": "v1",
 *   "timestamp": "ISO-8601",
 *   "totalFiles": number,
 *   "successful": number,
 *   "failed": number,
 *   "results": ExtractionResult[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { ExtractorRouter } from "@/lib/nural-extractor";
import type {
  ExtractionResult,
  ExtractedDocument,
} from "@/lib/nural-extractor";
import {
  extractionResultsToMarkdown,
  extractionResultsToText,
  parseOutputFormat,
} from "@/lib/nural-extractor/output-formatters";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Allow up to 60s execution for large / batch file processing */
export const maxDuration = 60;

/** 50 MB per-file limit */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Singleton router (reused across requests) */
const router = new ExtractorRouter();

// ---------------------------------------------------------------------------
// MIME helpers
// ---------------------------------------------------------------------------

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

/** Supported MIME types (deduplicated) */
const SUPPORTED_TYPES = [...new Set(Object.values(EXTENSION_MIME_MAP))];

/**
 * Resolve effective MIME type for a file, falling back to extension-based
 * detection when the browser sends `application/octet-stream`.
 */
function resolveMimeType(file: File): string {
  const browserType = file.type?.toLowerCase();
  if (browserType && browserType !== "application/octet-stream") {
    return browserType;
  }
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return EXTENSION_MIME_MAP[ext] ?? browserType ?? "application/octet-stream";
}

// ---------------------------------------------------------------------------
// v1 response wrapper
// ---------------------------------------------------------------------------

interface V1ExtractionResponse {
  apiVersion: "v1";
  timestamp: string;
  totalFiles: number;
  successful: number;
  failed: number;
  results: ExtractionResult[];
}

function buildResponse(results: ExtractionResult[]): V1ExtractionResponse {
  const successful = results.filter((r) => r.success).length;
  return {
    apiVersion: "v1",
    timestamp: new Date().toISOString(),
    totalFiles: results.length,
    successful,
    failed: results.length - successful,
    results,
  };
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/extract
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // ── Validate content type ──
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          apiVersion: "v1",
          error: "Invalid content type. Expected multipart/form-data.",
          usage: "POST with multipart/form-data, field name: 'files'",
        },
        { status: 415, headers: corsHeaders() }
      );
    }

    // ── Parse form data ──
    const formData = await request.formData();
    const files = formData.getAll("files");
    const requestedFormat =
      request.nextUrl.searchParams.get("format") ??
      (typeof formData.get("format") === "string"
        ? (formData.get("format") as string)
        : null);
    const outputFormat = parseOutputFormat(requestedFormat);

    if (!outputFormat) {
      return NextResponse.json(
        {
          apiVersion: "v1",
          error:
            "Invalid output format. Use one of: json, txt, md (or markdown).",
        },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          apiVersion: "v1",
          error:
            "No files provided. Upload one or more files using the 'files' form field.",
        },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ── Process each file concurrently ──
    const promises = files.map(async (entry): Promise<ExtractionResult> => {
      if (!(entry instanceof File)) {
        return {
          success: false,
          fileName: "(non-file field)",
          error: "Expected a file upload, received a string field.",
        };
      }

      const fileName = entry.name || "unnamed";

      try {
        // Size validation
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

        // Resolve MIME type
        const mimeType = resolveMimeType(entry);

        // Read buffer
        const arrayBuffer = await entry.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Extract & normalize
        const document: ExtractedDocument = await router.process(
          buffer,
          fileName,
          mimeType
        );

        return { success: true, document };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown extraction error";
        return { success: false, fileName, error: message };
      }
    });

    // allSettled so one rejection never crashes the batch
    const settled = await Promise.allSettled(promises);

    const results: ExtractionResult[] = settled.map((outcome) => {
      if (outcome.status === "fulfilled") return outcome.value;
      return {
        success: false as const,
        fileName: "unknown",
        error: outcome.reason?.message ?? "Unhandled extraction failure",
      };
    });

    const payload = buildResponse(results);

    if (outputFormat === "txt") {
      return new NextResponse(extractionResultsToText(results), {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    if (outputFormat === "md") {
      return new NextResponse(extractionResultsToMarkdown(results), {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "text/markdown; charset=utf-8",
        },
      });
    }

    return NextResponse.json(payload, {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { apiVersion: "v1", error: message },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// ---------------------------------------------------------------------------
// OPTIONS — CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// ---------------------------------------------------------------------------
// GET — Usage info (helpful for discovery)
// ---------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json(
    {
      apiVersion: "v1",
      endpoint: "/api/v1/extract",
      method: "POST",
      contentType: "multipart/form-data",
      fieldName: "files",
      description:
        "Upload one or more files to extract structured text content.",
      outputFormats: ["json", "txt", "md"],
      formatSelection: {
        query: "?format=json|txt|md",
        formField: "format=json|txt|md",
        default: "json",
      },
      limits: {
        maxFileSize: "50 MB",
        maxDuration: "60 seconds",
      },
      supportedFormats: [
        "PDF (.pdf)",
        "Word (.docx, .doc)",
        "Excel (.xlsx, .xls)",
        "CSV/TSV (.csv, .tsv)",
        "PowerPoint (.pptx, .ppt)",
        "HTML (.html, .htm)",
        "Images (.png, .jpg, .jpeg, .webp, .tiff, .gif, .bmp)",
      ],
      supportedMimeTypes: SUPPORTED_TYPES,
      example: {
        curl: 'curl -X POST "https://neural-extractor.onrender.com/api/v1/extract?format=md" -F "files=@document.pdf" -F "files=@spreadsheet.xlsx"',
      },
    },
    { status: 200, headers: corsHeaders() }
  );
}
