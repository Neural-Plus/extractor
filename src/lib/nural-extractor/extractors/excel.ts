/**
 * Nural+ Extractor — Excel Extractor
 *
 * Uses `exceljs` to load .xlsx / .xls workbooks and convert each worksheet
 * into a markdown-style table chunk.
 */

import ExcelJS from "exceljs";
import { v4 as uuidv4 } from "uuid";
import type { ContentChunk, ExtractedDocument, Extractor } from "../types";

const SUPPORTED_TYPES = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
];

export class ExcelExtractor implements Extractor {
    readonly name = "ExcelExtractor";

    supports(mimeType: string): boolean {
        return SUPPORTED_TYPES.includes(mimeType);
    }

    async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
        const workbook = new ExcelJS.Workbook();
        // ExcelJS expects an ArrayBuffer — extract the underlying buffer region
        const arrayBuffer = buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
        ) as ArrayBuffer;
        await workbook.xlsx.load(arrayBuffer);

        const chunks: ContentChunk[] = [];

        workbook.eachSheet((worksheet, sheetId) => {
            const rows: string[][] = [];

            worksheet.eachRow({ includeEmpty: false }, (row) => {
                const cells: string[] = [];
                row.eachCell({ includeEmpty: true }, (cell) => {
                    // Convert cell value to string, handling various types
                    const value = cell.value;
                    if (value === null || value === undefined) {
                        cells.push("");
                    } else if (typeof value === "object" && "result" in value) {
                        // Formula cell — use the computed result
                        cells.push(String((value as { result: unknown }).result ?? ""));
                    } else if (typeof value === "object" && "text" in value) {
                        // Rich text cell
                        cells.push(String((value as { text: string }).text));
                    } else {
                        cells.push(String(value));
                    }
                });
                rows.push(cells);
            });

            if (rows.length === 0) return;

            // Build a markdown-style table
            const header = rows[0];
            const separator = header.map(() => "---");
            const tableLines = [
                `| ${header.join(" | ")} |`,
                `| ${separator.join(" | ")} |`,
                ...rows.slice(1).map((row) => `| ${row.join(" | ")} |`),
            ];

            chunks.push({
                id: "",
                type: "table",
                text: tableLines.join("\n"),
                section: worksheet.name || `Sheet ${sheetId}`,
            });
        });

        return {
            documentId: uuidv4(),
            fileName,
            mimeType: SUPPORTED_TYPES[0],
            metadata: {
                sheetCount: workbook.worksheets.length,
                sheetNames: workbook.worksheets.map((ws) => ws.name),
            },
            chunks,
        };
    }
}
