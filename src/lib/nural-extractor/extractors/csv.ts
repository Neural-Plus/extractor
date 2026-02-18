/**
 * Nural+ Extractor — CSV Extractor
 *
 * Uses `csv-parse/sync` to parse CSV/TSV buffers and convert them into
 * a readable markdown-style table chunk.
 */

import { parse } from "csv-parse/sync";
import { v4 as uuidv4 } from "uuid";
import type { ContentChunk, ExtractedDocument, Extractor } from "../types";

const SUPPORTED_TYPES = [
    "text/csv",
    "text/tab-separated-values",
    "application/csv",
];

export class CsvExtractor implements Extractor {
    readonly name = "CsvExtractor";

    supports(mimeType: string): boolean {
        return SUPPORTED_TYPES.includes(mimeType);
    }

    async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
        const content = buffer.toString("utf-8");

        // Auto-detect delimiter (comma vs tab)
        const delimiter = content.includes("\t") ? "\t" : ",";

        const records: string[][] = parse(content, {
            delimiter,
            relax_column_count: true,
            skip_empty_lines: true,
            trim: true,
        });

        const chunks: ContentChunk[] = [];

        if (records.length > 0) {
            const header = records[0];
            const separator = header.map(() => "---");
            const tableLines = [
                `| ${header.join(" | ")} |`,
                `| ${separator.join(" | ")} |`,
                ...records.slice(1).map((row) => `| ${row.join(" | ")} |`),
            ];

            chunks.push({
                id: "",
                type: "table",
                text: tableLines.join("\n"),
            });
        }

        return {
            documentId: uuidv4(),
            fileName,
            mimeType: "text/csv",
            metadata: {
                rowCount: records.length,
                columnCount: records[0]?.length ?? 0,
                delimiter,
            },
            chunks,
        };
    }
}
