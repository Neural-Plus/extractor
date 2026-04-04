# Nural+ Extractor API Documentation

> **Version:** v1  
> **Base URL:** `https://neural-extarctor.netlify.app`

---

## Overview

The Nural+ Extractor API converts documents into clean, structured JSON. Upload any supported file and receive normalized text content organized into semantic chunks (headings, paragraphs, tables, lists) — ready for LLM pipelines, search indexing, or downstream processing.

---

## Endpoints

| Method    | Path                | Description                          |
|-----------|---------------------|--------------------------------------|
| `POST`    | `/api/v1/extract`   | Extract content from uploaded files  |
| `GET`     | `/api/v1/extract`   | Get endpoint usage info & supported formats |
| `OPTIONS` | `/api/v1/extract`   | CORS preflight                       |

---

## POST `/api/v1/extract`

Upload one or more files and receive structured extraction results as JSON.

### Request

| Header         | Value                 | Required |
|----------------|-----------------------|----------|
| `Content-Type` | `multipart/form-data` | Yes      |

| Form Field | Type   | Description                        | Required |
|------------|--------|------------------------------------|----------|
| `files`    | File(s)| One or more files to extract from  | Yes      |

### Limits

| Constraint        | Value       |
|-------------------|-------------|
| Max file size     | 50 MB       |
| Max execution time| 60 seconds  |
| Batch size        | No hard limit (bounded by execution time) |

### cURL Examples

**Single file:**

```bash
curl -X POST https://neural-extarctor.netlify.app/api/v1/extract \
  -F "files=@report.pdf"
```

**Multiple files (batch):**

```bash
curl -X POST https://neural-extarctor.netlify.app/api/v1/extract \
  -F "files=@report.pdf" \
  -F "files=@data.xlsx" \
  -F "files=@notes.docx"
```

**Save output to file:**

```bash
curl -X POST https://neural-extarctor.netlify.app/api/v1/extract \
  -F "files=@report.pdf" \
  -o result.json
```

### JavaScript / Fetch Example

```javascript
const formData = new FormData();
formData.append("files", fileInput.files[0]);

const response = await fetch("https://neural-extarctor.netlify.app/api/v1/extract", {
  method: "POST",
  body: formData,
});

const data = await response.json();
console.log(data);
```

### Python Example

```python
import requests

url = "https://neural-extarctor.netlify.app/api/v1/extract"
files = [
    ("files", ("report.pdf", open("report.pdf", "rb"), "application/pdf")),
    ("files", ("data.xlsx", open("data.xlsx", "rb"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")),
]

response = requests.post(url, files=files)
print(response.json())
```

---

## Response Format

### Success Response (200)

```json
{
  "apiVersion": "v1",
  "timestamp": "2026-03-02T12:00:00.000Z",
  "totalFiles": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "success": true,
      "document": {
        "documentId": "550e8400-e29b-41d4-a716-446655440000",
        "fileName": "report.pdf",
        "mimeType": "application/pdf",
        "metadata": {
          "pageCount": 12
        },
        "chunks": [
          {
            "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            "type": "heading",
            "text": "Introduction",
            "page": 1
          },
          {
            "id": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
            "type": "paragraph",
            "text": "This report covers the quarterly results...",
            "page": 1,
            "section": "Introduction"
          },
          {
            "id": "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
            "type": "table",
            "text": "Product | Revenue | Growth\nWidget A | $1.2M | +15%\nWidget B | $800K | +8%",
            "page": 3
          }
        ]
      }
    },
    {
      "success": true,
      "document": {
        "documentId": "...",
        "fileName": "data.xlsx",
        "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "metadata": {
          "sheetCount": 3
        },
        "chunks": [ ... ]
      }
    }
  ]
}
```

### Partial Failure Response (200)

When some files succeed and others fail, you still get a `200` with per-file status:

```json
{
  "apiVersion": "v1",
  "timestamp": "2026-03-02T12:00:00.000Z",
  "totalFiles": 2,
  "successful": 1,
  "failed": 1,
  "results": [
    {
      "success": true,
      "document": { ... }
    },
    {
      "success": false,
      "fileName": "corrupt.pdf",
      "error": "Failed to parse PDF: Invalid header"
    }
  ]
}
```

### Error Responses

| Status | Condition                              | Body                                              |
|--------|----------------------------------------|----------------------------------------------------|
| `400`  | No files in request                    | `{ "apiVersion": "v1", "error": "No files provided..." }` |
| `415`  | Wrong content type (not multipart)     | `{ "apiVersion": "v1", "error": "Invalid content type..." }` |
| `500`  | Unhandled server error                 | `{ "apiVersion": "v1", "error": "..." }`           |

---

## Output Schema

### `ExtractedDocument`

| Field        | Type               | Description                                      |
|--------------|--------------------|--------------------------------------------------|
| `documentId` | `string` (UUID v4) | Unique identifier for this extraction            |
| `fileName`   | `string`           | Original file name                               |
| `mimeType`   | `string`           | Detected MIME type                               |
| `metadata`   | `object`           | File-level metadata (page count, sheet count, etc.) |
| `chunks`     | `ContentChunk[]`   | Ordered list of extracted content chunks         |

### `ContentChunk`

| Field     | Type     | Description                                    |
|-----------|----------|------------------------------------------------|
| `id`      | `string` (UUID v4) | Unique chunk identifier                |
| `type`    | `string` | One of: `heading`, `paragraph`, `table`, `list` |
| `text`    | `string` | Extracted and normalized text content          |
| `page`    | `number` (optional) | Source page number (1-indexed)         |
| `section` | `string` (optional) | Logical section or slide name          |

---

## Supported Formats

| Format     | Extensions         | MIME Type(s)                                                     | Library Used       |
|------------|--------------------|------------------------------------------------------------------|--------------------|
| PDF        | `.pdf`             | `application/pdf`                                                | pdfjs-serverless   |
| Word       | `.docx`, `.doc`    | `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/msword` | mammoth |
| Excel      | `.xlsx`, `.xls`    | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`  | exceljs |
| CSV / TSV  | `.csv`, `.tsv`     | `text/csv`, `text/tab-separated-values`                          | csv-parse          |
| PowerPoint | `.pptx`, `.ppt`    | `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.ms-powerpoint` | jszip |
| HTML       | `.html`, `.htm`    | `text/html`                                                      | Built-in (regex)   |
| Images     | `.png`, `.jpg`, `.jpeg`, `.webp`, `.tiff`, `.gif`, `.bmp` | `image/png`, `image/jpeg`, `image/webp`, `image/tiff`, `image/gif`, `image/bmp` | sharp + Tesseract.js OCR |

---

## Normalization

All extracted text goes through the normalization pipeline before being returned:

1. **Artifact removal** — null bytes (`\x00`), form-feeds (`\x0C`), zero-width characters
2. **Whitespace collapsing** — runs of spaces/tabs become a single space
3. **Line merging** — single newlines become spaces; paragraph breaks (double newlines) are preserved
4. **Empty filtering** — chunks with no text after normalization are dropped
5. **UUID assignment** — every chunk receives a unique `id`

---

## CORS

The v1 endpoint includes permissive CORS headers by default:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

The `OPTIONS` handler returns `204 No Content` for preflight requests.

---

## GET `/api/v1/extract`

Returns endpoint metadata, supported formats, and a usage example. Useful for service discovery and health checks.

**Response:**

```json
{
  "apiVersion": "v1",
  "endpoint": "/api/v1/extract",
  "method": "POST",
  "contentType": "multipart/form-data",
  "fieldName": "files",
  "description": "Upload one or more files to extract structured text content as JSON.",
  "limits": {
    "maxFileSize": "50 MB",
    "maxDuration": "60 seconds"
  },
  "supportedFormats": [
    "PDF (.pdf)",
    "Word (.docx, .doc)",
    "Excel (.xlsx, .xls)",
    "CSV/TSV (.csv, .tsv)",
    "PowerPoint (.pptx, .ppt)",
    "HTML (.html, .htm)",
    "Images (.png, .jpg, .jpeg, .webp, .tiff, .gif, .bmp)"
  ],
  "supportedMimeTypes": [ ... ],
  "example": {
    "curl": "curl -X POST https://neural-extarctor.netlify.app/api/v1/extract -F \"files=@document.pdf\""
  }
}
```

---

## Error Handling

- **Per-file isolation:** Each file is processed independently. If one file fails, the others still succeed. Check `results[i].success` for each file.
- **Unsupported format:** Returns `success: false` with error `"No extractor registered for MIME type: ..."`.
- **MIME fallback:** If the browser sends `application/octet-stream`, the API falls back to extension-based MIME detection.
- **Size limit:** Files over 50 MB return `success: false` without being processed.
- **Empty files:** Rejected with `"File is empty."`.

---

## Integration Tips

- **Field name must be `files`** — other field names are ignored.
- **Batch is recommended** — sending multiple files in one request is more efficient than individual calls.
- **Check `success` per result** — even on a `200` response, individual files may have failed.
- **The `metadata` object varies by format** — PDFs include `pageCount`, Excel includes `sheetCount`, etc.
- **Chunk `type` is semantic** — use it to filter or prioritize content (e.g., only headings, skip tables).

---

*Nural+ Extractor API v1 — Built with Next.js & TypeScript*
