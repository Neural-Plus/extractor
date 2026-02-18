# Nural+ Extractor

> Document ingestion and extraction system for AI pipelines.  
> Converts PDF, DOCX, PPTX, Excel, CSV, HTML, and images into clean, normalized structured JSON.

---

## Architecture

```
src/lib/nural-extractor/
├── index.ts          # Barrel export
├── types.ts          # Shared types & interfaces
├── normalize.ts      # Text normalization engine
├── router.ts         # Extractor registry & routing
└── extractors/
    ├── pdf.ts        # pdfjs-serverless
    ├── docx.ts       # mammoth
    ├── excel.ts      # exceljs
    ├── csv.ts        # csv-parse
    ├── pptx.ts       # jszip
    ├── html.ts       # regex-based tag stripping
    └── image.ts      # sharp metadata + OcrProvider interface
```

### Flow

```
File Upload  →  MIME Detection  →  Router  →  Extractor  →  Normalizer  →  JSON
```

1. **API Route** (`/api/nural/extract`) receives multipart/form-data
2. **Router** matches the file's MIME type to a registered `Extractor`
3. **Extractor** parses the raw buffer into an `ExtractedDocument`
4. **Normalizer** cleans text, assigns chunk IDs, removes artifacts

---

## Output Schema

Every document (regardless of source format) returns:

```json
{
  "documentId": "uuid-v4",
  "fileName": "report.pdf",
  "mimeType": "application/pdf",
  "metadata": { "pageCount": 12 },
  "chunks": [
    {
      "id": "uuid-v4",
      "type": "heading | paragraph | table | list",
      "text": "...",
      "page": 1,
      "section": "Introduction"
    }
  ]
}
```

---

## API Usage

### `POST /api/nural/extract`

Upload one or more files:

```bash
curl -X POST http://localhost:3000/api/nural/extract \
  -F "files=@report.pdf" \
  -F "files=@data.xlsx"
```

**Response:**

```json
{
  "results": [
    { "success": true, "document": { ... } },
    { "success": false, "fileName": "corrupt.pdf", "error": "..." }
  ]
}
```

- Max file size: **50 MB** per file
- Failures are isolated per file — one bad file won't crash the batch

---

## Supported Formats

| Format  | MIME Type                               | Library            |
|---------|-----------------------------------------|--------------------|
| PDF     | `application/pdf`                       | pdfjs-serverless   |
| DOCX    | `application/vnd.openxml...document`    | mammoth            |
| XLSX    | `application/vnd.openxml...sheet`       | exceljs            |
| CSV/TSV | `text/csv`, `text/tab-separated-values` | csv-parse          |
| PPTX    | `application/vnd.openxml...presentation`| jszip              |
| HTML    | `text/html`                             | built-in (regex)   |
| Images  | `image/png`, `image/jpeg`, etc.         | sharp + OCR plugin |

---

## Extending: Adding a Custom Extractor

1. Create a class implementing the `Extractor` interface:

```typescript
import type { Extractor, ExtractedDocument } from "@/lib/nural-extractor";

export class MarkdownExtractor implements Extractor {
  readonly name = "MarkdownExtractor";

  supports(mimeType: string): boolean {
    return mimeType === "text/markdown";
  }

  async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
    // ... parse buffer, return ExtractedDocument
  }
}
```

2. Register it with the router:

```typescript
import { ExtractorRouter } from "@/lib/nural-extractor";
import { MarkdownExtractor } from "./my-extractor";

const router = new ExtractorRouter();           // built-ins auto-registered
router.register(new MarkdownExtractor());       // add custom extractor
```

---

## OCR Integration (Future)

The `ImageExtractor` accepts a pluggable `OcrProvider`:

```typescript
import { ImageExtractor } from "@/lib/nural-extractor/extractors/image";

const imageExtractor = new ImageExtractor();
imageExtractor.setOcrProvider({
  async recognize(buffer: Buffer): Promise<string> {
    // call Tesseract, Google Vision, AWS Textract, etc.
    return recognizedText;
  },
});
```

Sharp automatically preprocesses images (greyscale, normalize) before passing to the OCR provider.

---

## Development

```bash
npm run dev       # Start dev server
npm run build     # Production build
```

---

## Normalization

The normalizer (`normalize.ts`) applies:

- **Whitespace collapsing** — removes runs of spaces/tabs
- **Line merging** — single newlines become spaces, preserving paragraph breaks
- **Artifact removal** — null bytes, form-feeds, zero-width chars
- **Empty filtering** — drops chunks with no text
- **UUID assignment** — every chunk gets a unique `id`

---

*Built with TypeScript · Next.js 15 · Functional, composable, extensible.*
