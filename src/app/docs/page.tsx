"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ─── Code Block Component ─────────────────────────────────────
function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="docs-code-block">
            <div className="docs-code-header">
                <span className="docs-code-lang">{language}</span>
                <button className="docs-code-copy" onClick={handleCopy}>
                    {copied ? "✓ Copied" : "Copy"}
                </button>
            </div>
            <pre className="docs-code-pre">
                <code>{code}</code>
            </pre>
        </div>
    );
}

// ─── Data ─────────────────────────────────────────────────────
const SUPPORTED_FORMATS = [
    { format: "PDF", extensions: ".pdf", mime: "application/pdf", library: "pdfjs-serverless" },
    { format: "Word", extensions: ".docx, .doc", mime: "application/vnd.openxml...document", library: "mammoth" },
    { format: "Excel", extensions: ".xlsx, .xls", mime: "application/vnd.openxml...sheet", library: "exceljs" },
    { format: "CSV / TSV", extensions: ".csv, .tsv", mime: "text/csv, text/tab-separated-values", library: "csv-parse" },
    { format: "PowerPoint", extensions: ".pptx, .ppt", mime: "application/vnd.openxml...presentation", library: "jszip" },
    { format: "HTML", extensions: ".html, .htm", mime: "text/html", library: "built-in" },
    { format: "Images", extensions: ".png, .jpg, .jpeg, .webp, .tiff, .gif, .bmp", mime: "image/*", library: "sharp + Tesseract.js" },
];

const RESPONSE_FIELDS = [
    { field: "apiVersion", type: "string", description: 'Always "v1"' },
    { field: "timestamp", type: "string", description: "ISO-8601 timestamp of the response" },
    { field: "totalFiles", type: "number", description: "Number of files submitted" },
    { field: "successful", type: "number", description: "Number of successfully extracted files" },
    { field: "failed", type: "number", description: "Number of failed extractions" },
    { field: "results", type: "ExtractionResult[]", description: "Per-file extraction results" },
];

const DOC_FIELDS = [
    { field: "documentId", type: "string (UUID)", description: "Unique identifier for this extraction" },
    { field: "fileName", type: "string", description: "Original file name" },
    { field: "mimeType", type: "string", description: "Detected MIME type" },
    { field: "metadata", type: "object", description: "File-level metadata (pageCount, sheetCount, etc.)" },
    { field: "chunks", type: "ContentChunk[]", description: "Ordered list of content chunks" },
];

const CHUNK_FIELDS = [
    { field: "id", type: "string (UUID)", description: "Unique chunk identifier" },
    { field: "type", type: "string", description: 'One of: "heading", "paragraph", "table", "list"' },
    { field: "text", type: "string", description: "Extracted and normalized text content" },
    { field: "page", type: "number?", description: "Source page number (1-indexed), if applicable" },
    { field: "section", type: "string?", description: "Logical section or slide name, if available" },
];

const ERROR_CODES = [
    { status: "200", condition: "Success (even partial)", description: "All or some files extracted. Check results[i].success per file." },
    { status: "400", condition: "No files provided", description: "Request had no files in the 'files' form field." },
    { status: "415", condition: "Wrong content type", description: "Expected multipart/form-data." },
    { status: "500", condition: "Server error", description: "Unhandled internal error." },
];

// ─── Page Component ───────────────────────────────────────────
export default function ApiDocsPage() {
    const [activeSection, setActiveSection] = useState("overview");

    const sections = [
        { id: "overview", label: "Overview" },
        { id: "endpoint", label: "Endpoint" },
        { id: "request", label: "Request" },
        { id: "response", label: "Response" },
        { id: "schema", label: "Schema" },
        { id: "formats", label: "Formats" },
        { id: "examples", label: "Examples" },
        { id: "errors", label: "Errors" },
    ];

    // Track which sections are visible and pick the topmost one
    const visibleSections = useRef<Set<string>>(new Set());

    useEffect(() => {
        const sectionIds = sections.map((s) => s.id);
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        visibleSections.current.add(entry.target.id);
                    } else {
                        visibleSections.current.delete(entry.target.id);
                    }
                });

                // Pick the first visible section in document order
                const current = sectionIds.find((id) =>
                    visibleSections.current.has(id)
                );
                if (current) setActiveSection(current);
            },
            {
                rootMargin: "-80px 0px -40% 0px",
                threshold: 0.1,
            }
        );

        sectionIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="docs-page">
            {/* ── Background ── */}
            <div className="landing-glow landing-glow-1" />
            <div className="landing-glow landing-glow-2" />

            {/* ── Nav ── */}
            <nav className="landing-nav">
                <div className="landing-nav-inner">
                    <Link href="/" className="landing-logo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/neural+_inspiration-removebg-preview.png"
                            alt="Neural+"
                            width={36}
                            height={36}
                            className="landing-logo-img"
                        />
                        <span className="landing-logo-text">Neural+</span>
                    </Link>
                    <div className="nav-links">
                        <Link href="/contact" className="nav-link">Contact</Link>
                        <Link href="/extract" className="nav-cta">Launch App →</Link>
                    </div>
                </div>
            </nav>

            {/* ── Layout ── */}
            <div className="docs-layout">
                {/* ── Sidebar ── */}
                <aside className="docs-sidebar">
                    <div className="docs-sidebar-header">
                        <span className="docs-sidebar-badge">v1</span>
                        <span>API Reference</span>
                    </div>
                    <nav className="docs-sidebar-nav">
                        {sections.map((s) => (
                            <a
                                key={s.id}
                                href={`#${s.id}`}
                                className={`docs-sidebar-link ${activeSection === s.id ? "active" : ""}`}
                                onClick={() => setActiveSection(s.id)}
                            >
                                {s.label}
                            </a>
                        ))}
                    </nav>
                </aside>

                {/* ── Content ── */}
                <main className="docs-content">
                    {/* Overview */}
                    <section id="overview" className="docs-section">
                        <div className="hero-badge" style={{ marginBottom: 16 }}>
                            <span className="hero-badge-dot" />
                            API DOCUMENTATION
                        </div>
                        <h1 className="docs-title">Nural+ Extractor API</h1>
                        <p className="docs-subtitle">
                            Convert any document into clean, structured JSON. Upload PDFs, Word docs,
                            spreadsheets, presentations, images — and get normalized, chunked content
                            ready for LLMs and AI pipelines.
                        </p>

                        <div className="docs-info-cards">
                            <div className="docs-info-card">
                                <div className="docs-info-label">Base URL</div>
                                <code className="docs-info-value">https://neural-extarctor.netlify.app</code>
                            </div>
                            <div className="docs-info-card">
                                <div className="docs-info-label">Version</div>
                                <code className="docs-info-value">v1</code>
                            </div>
                            <div className="docs-info-card">
                                <div className="docs-info-label">Auth</div>
                                <code className="docs-info-value">None required</code>
                            </div>
                        </div>
                    </section>

                    {/* Endpoint */}
                    <section id="endpoint" className="docs-section">
                        <h2 className="docs-heading">Endpoint</h2>

                        <div className="docs-endpoint-card">
                            <div className="docs-method-badge post">POST</div>
                            <code className="docs-endpoint-path">/api/v1/extract</code>
                        </div>

                        <p className="docs-text">
                            Upload one or more files and receive structured extraction results as JSON.
                            Files are processed in parallel with per-file error isolation.
                        </p>

                        <div className="docs-limits-grid">
                            <div className="docs-limit-item">
                                <span className="docs-limit-icon">📦</span>
                                <div>
                                    <div className="docs-limit-label">Max File Size</div>
                                    <div className="docs-limit-value">50 MB per file</div>
                                </div>
                            </div>
                            <div className="docs-limit-item">
                                <span className="docs-limit-icon">⏱️</span>
                                <div>
                                    <div className="docs-limit-label">Max Duration</div>
                                    <div className="docs-limit-value">60 seconds</div>
                                </div>
                            </div>
                            <div className="docs-limit-item">
                                <span className="docs-limit-icon">📁</span>
                                <div>
                                    <div className="docs-limit-label">Batch Upload</div>
                                    <div className="docs-limit-value">Multiple files per request</div>
                                </div>
                            </div>
                            <div className="docs-limit-item">
                                <span className="docs-limit-icon">🔓</span>
                                <div>
                                    <div className="docs-limit-label">CORS</div>
                                    <div className="docs-limit-value">All origins allowed</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Request */}
                    <section id="request" className="docs-section">
                        <h2 className="docs-heading">Request</h2>

                        <h3 className="docs-subheading">Headers</h3>
                        <div className="docs-table-wrap">
                            <table className="docs-table">
                                <thead>
                                    <tr>
                                        <th>Header</th>
                                        <th>Value</th>
                                        <th>Required</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><code>Content-Type</code></td>
                                        <td><code>multipart/form-data</code></td>
                                        <td><span className="docs-badge-required">Required</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h3 className="docs-subheading">Form Fields</h3>
                        <div className="docs-table-wrap">
                            <table className="docs-table">
                                <thead>
                                    <tr>
                                        <th>Field</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><code>files</code></td>
                                        <td>File(s)</td>
                                        <td>One or more files to extract. Use the same field name for batch uploads.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Response */}
                    <section id="response" className="docs-section">
                        <h2 className="docs-heading">Response</h2>

                        <h3 className="docs-subheading">Top-Level Fields</h3>
                        <div className="docs-table-wrap">
                            <table className="docs-table">
                                <thead>
                                    <tr>
                                        <th>Field</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {RESPONSE_FIELDS.map((f) => (
                                        <tr key={f.field}>
                                            <td><code>{f.field}</code></td>
                                            <td><code>{f.type}</code></td>
                                            <td>{f.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <h3 className="docs-subheading">Example Response</h3>
                        <CodeBlock
                            language="json"
                            code={`{
  "apiVersion": "v1",
  "timestamp": "2026-03-02T12:00:00.000Z",
  "totalFiles": 2,
  "successful": 1,
  "failed": 1,
  "results": [
    {
      "success": true,
      "document": {
        "documentId": "550e8400-e29b-41d4-a716-446655440000",
        "fileName": "report.pdf",
        "mimeType": "application/pdf",
        "metadata": { "pageCount": 12 },
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
          }
        ]
      }
    },
    {
      "success": false,
      "fileName": "corrupt.pdf",
      "error": "Failed to parse PDF: Invalid header"
    }
  ]
}`}
                        />
                    </section>

                    {/* Schema */}
                    <section id="schema" className="docs-section">
                        <h2 className="docs-heading">Schema</h2>

                        <h3 className="docs-subheading">ExtractedDocument</h3>
                        <div className="docs-table-wrap">
                            <table className="docs-table">
                                <thead>
                                    <tr>
                                        <th>Field</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {DOC_FIELDS.map((f) => (
                                        <tr key={f.field}>
                                            <td><code>{f.field}</code></td>
                                            <td><code>{f.type}</code></td>
                                            <td>{f.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <h3 className="docs-subheading">ContentChunk</h3>
                        <div className="docs-table-wrap">
                            <table className="docs-table">
                                <thead>
                                    <tr>
                                        <th>Field</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {CHUNK_FIELDS.map((f) => (
                                        <tr key={f.field}>
                                            <td><code>{f.field}</code></td>
                                            <td><code>{f.type}</code></td>
                                            <td>{f.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Supported Formats */}
                    <section id="formats" className="docs-section">
                        <h2 className="docs-heading">Supported Formats</h2>
                        <div className="docs-table-wrap">
                            <table className="docs-table">
                                <thead>
                                    <tr>
                                        <th>Format</th>
                                        <th>Extensions</th>
                                        <th>MIME Type</th>
                                        <th>Library</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {SUPPORTED_FORMATS.map((f) => (
                                        <tr key={f.format}>
                                            <td><strong>{f.format}</strong></td>
                                            <td><code>{f.extensions}</code></td>
                                            <td><code>{f.mime}</code></td>
                                            <td>{f.library}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Examples */}
                    <section id="examples" className="docs-section">
                        <h2 className="docs-heading">Examples</h2>

                        <h3 className="docs-subheading">cURL — Single File</h3>
                        <CodeBlock
                            language="bash"
                            code={`curl -X POST https://neural-extarctor.netlify.app/api/v1/extract \\
  -F "files=@report.pdf"`}
                        />

                        <h3 className="docs-subheading">cURL — Batch Upload</h3>
                        <CodeBlock
                            language="bash"
                            code={`curl -X POST https://neural-extarctor.netlify.app/api/v1/extract \\
  -F "files=@report.pdf" \\
  -F "files=@data.xlsx" \\
  -F "files=@notes.docx"`}
                        />

                        <h3 className="docs-subheading">JavaScript / Fetch</h3>
                        <CodeBlock
                            language="javascript"
                            code={`const formData = new FormData();
formData.append("files", fileInput.files[0]);

const response = await fetch("/api/v1/extract", {
  method: "POST",
  body: formData,
});

const data = await response.json();
console.log(data.results);`}
                        />

                        <h3 className="docs-subheading">Python</h3>
                        <CodeBlock
                            language="python"
                            code={`import requests

url = "https://neural-extarctor.netlify.app/api/v1/extract"
files = [
    ("files", ("report.pdf", open("report.pdf", "rb"), "application/pdf")),
    ("files", ("data.xlsx", open("data.xlsx", "rb"),
     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")),
]

response = requests.post(url, files=files)
print(response.json())`}
                        />

                        <h3 className="docs-subheading">GET — Service Discovery</h3>
                        <CodeBlock
                            language="bash"
                            code={`curl https://neural-extarctor.netlify.app/api/v1/extract`}
                        />
                        <p className="docs-text" style={{ marginTop: 12 }}>
                            The GET endpoint returns supported formats, limits, and usage info — useful for
                            health checks and integration discovery.
                        </p>
                    </section>

                    {/* Errors */}
                    <section id="errors" className="docs-section">
                        <h2 className="docs-heading">Error Handling</h2>
                        <div className="docs-table-wrap">
                            <table className="docs-table">
                                <thead>
                                    <tr>
                                        <th>Status</th>
                                        <th>Condition</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ERROR_CODES.map((e) => (
                                        <tr key={e.status}>
                                            <td><span className={`docs-status-badge status-${e.status}`}>{e.status}</span></td>
                                            <td>{e.condition}</td>
                                            <td>{e.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="docs-callout">
                            <div className="docs-callout-icon">💡</div>
                            <div>
                                <strong>Per-file isolation:</strong> Even on a <code>200</code> response,
                                individual files may have failed. Always check <code>results[i].success</code> for
                                each file in the response.
                            </div>
                        </div>

                        <div className="docs-callout">
                            <div className="docs-callout-icon">🔍</div>
                            <div>
                                <strong>MIME fallback:</strong> If the browser sends <code>application/octet-stream</code>,
                                the API automatically detects MIME type from the file extension.
                            </div>
                        </div>
                    </section>

                    {/* Footer */}
                    <footer className="docs-footer">
                        <p>Nural+ Extractor API v1 — Built with Next.js &amp; TypeScript</p>
                    </footer>
                </main>
            </div>
        </div>
    );
}
