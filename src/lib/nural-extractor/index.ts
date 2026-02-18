/**
 * Nural+ Extractor — Public API
 *
 * Barrel export — import everything from `@/lib/nural-extractor`.
 */

export { ExtractorRouter } from "./router";
export { normalizeText, normalizeChunks, normalizeDocument } from "./normalize";
export type {
    ChunkType,
    ContentChunk,
    DocumentMetadata,
    ExtractedDocument,
    Extractor,
    ExtractionResult,
    ExtractionResponse,
    OcrProvider,
} from "./types";
