/**
 * Nural+ Extractor — Type Definitions
 *
 * Shared types and interfaces for the document extraction pipeline.
 * Every extractor must conform to the `Extractor` interface and return
 * an `ExtractedDocument` in the unified output schema.
 */

// ---------------------------------------------------------------------------
// Chunk Types
// ---------------------------------------------------------------------------

/** Semantic type of a content chunk */
export type ChunkType = "heading" | "paragraph" | "table" | "list" | "image";

/** A single unit of extracted content */
export interface ContentChunk {
  /** Unique identifier for this chunk (assigned during normalization) */
  id: string;
  /** Semantic type */
  type: ChunkType;
  /** The textual content */
  text: string;
  /** Source page number (1-indexed), when applicable */
  page?: number;
  /** Logical section or slide name, when available */
  section?: string;
}

// ---------------------------------------------------------------------------
// Document Types
// ---------------------------------------------------------------------------

/** Arbitrary metadata bag attached to an extracted document */
export type DocumentMetadata = Record<string, unknown>;

/** Unified output schema returned by every extractor after normalization */
export interface ExtractedDocument {
  /** Unique document identifier (UUID v4) */
  documentId: string;
  /** Original file name */
  fileName: string;
  /** Detected MIME type */
  mimeType: string;
  /** File-level metadata (author, page count, etc.) */
  metadata: DocumentMetadata;
  /** Ordered list of content chunks */
  chunks: ContentChunk[];
}

// ---------------------------------------------------------------------------
// Extractor Interface
// ---------------------------------------------------------------------------

/**
 * Contract that every document extractor must implement.
 *
 * The `supports` method is used by the router to determine which extractor
 * handles a given MIME type.  `extract` performs the actual parsing.
 */
export interface Extractor {
  /** Human-readable name of the extractor (for logging / debugging) */
  readonly name: string;

  /** Return `true` if this extractor can handle the given MIME type */
  supports(mimeType: string): boolean;

  /**
   * Parse the raw file buffer and return an `ExtractedDocument`.
   *
   * Implementors should NOT call normalize — the router handles that.
   */
  extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument>;
}

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

/** Per-file result wrapper — either success or error */
export type ExtractionResult =
  | { success: true; document: ExtractedDocument }
  | { success: false; fileName: string; error: string };

/** Top-level API response */
export interface ExtractionResponse {
  results: ExtractionResult[];
}

// ---------------------------------------------------------------------------
// OCR Provider (future integration point)
// ---------------------------------------------------------------------------

/**
 * Interface for pluggable OCR backends.
 * Implement this and pass it to the ImageExtractor to enable real OCR.
 */
export interface OcrProvider {
  /** Recognize text from a preprocessed image buffer */
  recognize(imageBuffer: Buffer): Promise<string>;
}
