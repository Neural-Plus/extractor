import type { ExtractedDocument, ExtractionResult } from "./types";

export type OutputFormat = "json" | "txt" | "md";

export function parseOutputFormat(value: string | null): OutputFormat | null {
  if (!value) return "json";

  const normalized = value.trim().toLowerCase();
  if (normalized === "json") return "json";
  if (normalized === "txt" || normalized === "text") return "txt";
  if (normalized === "md" || normalized === "markdown") return "md";

  return null;
}

function formatMetadataValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function documentsToText(documents: ExtractedDocument[]): string {
  return documents
    .map((doc) => {
      const header = `===== ${doc.fileName} =====`;
      const chunks = doc.chunks
        .map((chunk) => {
          const prefix = chunk.page ? `[Page ${chunk.page}] ` : "";
          return `${prefix}${chunk.text}`;
        })
        .join("\n\n");

      return `${header}\n\n${chunks}`;
    })
    .join("\n\n\n");
}

function documentsToMarkdown(documents: ExtractedDocument[]): string {
  return documents
    .map((doc) => {
      const header = `# ${doc.fileName}\n\n> MIME: \`${doc.mimeType}\` | ID: \`${doc.documentId}\``;
      const metadata = Object.entries(doc.metadata)
        .map(([key, value]) => `- **${key}**: ${formatMetadataValue(value)}`)
        .join("\n");

      const chunks = doc.chunks
        .map((chunk) => {
          const pageBadge = chunk.page ? ` *(Page ${chunk.page})*` : "";

          if (chunk.type === "heading") return `## ${chunk.text}${pageBadge}`;
          if (chunk.type === "table") return `${pageBadge}\n\n${chunk.text}`;
          if (chunk.type === "list") return `${pageBadge}\n\n${chunk.text}`;
          return `${chunk.text}${pageBadge}`;
        })
        .join("\n\n");

      const metadataBlock = metadata ? `\n\n### Metadata\n\n${metadata}` : "";
      return `${header}${metadataBlock}\n\n---\n\n${chunks}`;
    })
    .join("\n\n---\n\n");
}

export function extractionResultsToText(results: ExtractionResult[]): string {
  const successfulDocs = results
    .filter((result): result is Extract<ExtractionResult, { success: true }> =>
      result.success
    )
    .map((result) => result.document);

  const failedResults = results.filter(
    (result): result is Extract<ExtractionResult, { success: false }> =>
      !result.success
  );

  const sections: string[] = [];

  if (successfulDocs.length > 0) {
    sections.push(documentsToText(successfulDocs));
  } else {
    sections.push("No successful extraction results.");
  }

  if (failedResults.length > 0) {
    const failedText = failedResults
      .map((result) => `- ${result.fileName}: ${result.error}`)
      .join("\n");

    sections.push(`FAILED FILES\n${failedText}`);
  }

  return sections.join("\n\n");
}

export function extractionResultsToMarkdown(results: ExtractionResult[]): string {
  const successfulDocs = results
    .filter((result): result is Extract<ExtractionResult, { success: true }> =>
      result.success
    )
    .map((result) => result.document);

  const failedResults = results.filter(
    (result): result is Extract<ExtractionResult, { success: false }> =>
      !result.success
  );

  const sections: string[] = [];

  if (successfulDocs.length > 0) {
    sections.push(documentsToMarkdown(successfulDocs));
  } else {
    sections.push("# Extraction Results\n\nNo successful extraction results.");
  }

  if (failedResults.length > 0) {
    const failedText = failedResults
      .map((result) => `- **${result.fileName}**: ${result.error}`)
      .join("\n");

    sections.push(`## Failed Files\n\n${failedText}`);
  }

  return sections.join("\n\n---\n\n");
}
