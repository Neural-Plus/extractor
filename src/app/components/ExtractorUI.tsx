"use client";

import { useState, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────
interface ContentChunk {
    id: string;
    type: "heading" | "paragraph" | "table" | "list";
    text: string;
    page?: number;
    section?: string;
}

interface ExtractedDocument {
    documentId: string;
    fileName: string;
    mimeType: string;
    metadata: Record<string, unknown>;
    chunks: ContentChunk[];
}

type ExtractionResult =
    | { success: true; document: ExtractedDocument }
    | { success: false; fileName: string; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string): string {
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function getFileTypeClass(name: string): string {
    const ext = getFileExtension(name);
    const map: Record<string, string> = {
        pdf: "pdf",
        docx: "docx",
        doc: "docx",
        xlsx: "xlsx",
        xls: "xlsx",
        csv: "csv",
        tsv: "csv",
        pptx: "pptx",
        ppt: "pptx",
        html: "html",
        htm: "html",
        png: "image",
        jpg: "image",
        jpeg: "image",
        webp: "image",
        gif: "image",
        tiff: "image",
        bmp: "image",
    };
    return map[ext] ?? "unknown";
}

function getFileTypeLabel(name: string): string {
    const ext = getFileExtension(name);
    return ext ? ext.toUpperCase() : "FILE";
}

const SUPPORTED_FORMATS = [
    "PDF",
    "DOCX",
    "XLSX",
    "CSV",
    "PPTX",
    "HTML",
    "PNG",
    "JPG",
];

// ─── Component ────────────────────────────────────────────────────────
export default function ExtractorUI() {
    const [files, setFiles] = useState<File[]>([]);
    const [results, setResults] = useState<ExtractionResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // ── File handling ──
    const addFiles = useCallback((incoming: FileList | File[]) => {
        const arr = Array.from(incoming);
        setFiles((prev) => {
            const names = new Set(prev.map((f) => f.name));
            return [...prev, ...arr.filter((f) => !names.has(f.name))];
        });
    }, []);

    const removeFile = useCallback((index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const clearAll = useCallback(() => {
        setFiles([]);
        setResults([]);
        setExpandedCards(new Set());
    }, []);

    // ── Drag & Drop ──
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragIn = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    }, []);

    const handleDragOut = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
            if (e.dataTransfer.files.length > 0) {
                addFiles(e.dataTransfer.files);
            }
        },
        [addFiles]
    );

    // ── Upload & Extract ──
    const handleExtract = useCallback(async () => {
        if (files.length === 0) return;

        setLoading(true);
        setResults([]);
        setExpandedCards(new Set());

        try {
            const formData = new FormData();
            files.forEach((file) => formData.append("files", file));

            const res = await fetch("/api/nural/extract", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (data.results) {
                setResults(data.results);
                // Auto-expand first successful result
                const firstSuccess = data.results.findIndex(
                    (r: ExtractionResult) => r.success
                );
                if (firstSuccess >= 0) {
                    setExpandedCards(new Set([firstSuccess]));
                }
            } else if (data.error) {
                setResults([
                    {
                        success: false,
                        fileName: "Request",
                        error: data.error,
                    },
                ]);
            }
        } catch (err) {
            setResults([
                {
                    success: false,
                    fileName: "Request",
                    error: err instanceof Error ? err.message : "Network error",
                },
            ]);
        } finally {
            setLoading(false);
        }
    }, [files]);

    const toggleCard = useCallback((index: number) => {
        setExpandedCards((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    }, []);

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    return (
        <div className="app-container">
            {/* ── Header ── */}
            <header className="header">
                <div className="header-badge">
                    <span className="header-badge-dot" />
                    Nural+ Extractor
                </div>
                <h1>Document Extraction</h1>
                <p>
                    Upload documents and extract structured, normalized content ready for
                    LLM processing and AI pipelines.
                </p>
            </header>

            {/* ── Dropzone ── */}
            <div className="dropzone-wrapper">
                <div
                    className={`dropzone ${dragActive ? "active" : ""}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={handleDrag}
                    onDragEnter={handleDragIn}
                    onDragLeave={handleDragOut}
                    onDrop={handleDrop}
                >
                    <div className="dropzone-icon">📄</div>
                    <h3>
                        Drop files here or <span>browse</span>
                    </h3>
                    <p>Supports multiple files up to 50 MB each</p>
                    <div className="formats-row">
                        {SUPPORTED_FORMATS.map((fmt) => (
                            <span key={fmt} className="format-tag">
                                {fmt}
                            </span>
                        ))}
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        onChange={(e) => e.target.files && addFiles(e.target.files)}
                    />
                </div>
            </div>

            {/* ── File Queue ── */}
            {files.length > 0 && (
                <div className="file-queue">
                    <div className="file-queue-header">
                        <h3>Queued Files</h3>
                        <span className="file-queue-count">
                            {files.length} file{files.length > 1 ? "s" : ""}
                        </span>
                    </div>
                    <div className="file-list">
                        {files.map((file, i) => (
                            <div key={file.name} className="file-item">
                                <div
                                    className={`file-type-icon ${getFileTypeClass(file.name)}`}
                                >
                                    {getFileTypeLabel(file.name)}
                                </div>
                                <div className="file-info">
                                    <div className="file-name">{file.name}</div>
                                    <div className="file-size">{formatFileSize(file.size)}</div>
                                </div>
                                <button
                                    className="file-remove"
                                    onClick={() => removeFile(i)}
                                    aria-label="Remove file"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Action Bar ── */}
            {files.length > 0 && (
                <div className="action-bar">
                    <button
                        className="btn btn-primary"
                        onClick={handleExtract}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="spinner" />
                                Extracting…
                            </>
                        ) : (
                            <>🚀 Extract All</>
                        )}
                    </button>
                    <button className="btn btn-secondary" onClick={clearAll}>
                        Clear
                    </button>
                </div>
            )}

            {/* ── Results ── */}
            {results.length > 0 && (
                <div className="results-section">
                    <div className="results-header">
                        <h2>Results</h2>
                        <div className="results-stats">
                            {successCount > 0 && (
                                <span className="stat-badge success">
                                    ✓ {successCount} extracted
                                </span>
                            )}
                            {errorCount > 0 && (
                                <span className="stat-badge error">
                                    ✕ {errorCount} failed
                                </span>
                            )}
                        </div>
                    </div>

                    {results.map((result, i) => (
                        <div key={i} className="result-card">
                            <div className="result-card-header" onClick={() => toggleCard(i)}>
                                <div
                                    className={`result-status-dot ${result.success ? "success" : "error"}`}
                                />
                                <span className="result-card-title">
                                    {result.success ? result.document.fileName : result.fileName}
                                </span>
                                {result.success && (
                                    <span className="result-card-meta">
                                        {result.document.chunks.length} chunks
                                    </span>
                                )}
                                <span
                                    className={`result-card-chevron ${expandedCards.has(i) ? "open" : ""}`}
                                >
                                    ▾
                                </span>
                            </div>

                            {expandedCards.has(i) && (
                                <>
                                    {result.success ? (
                                        <div className="result-card-body">
                                            {/* Metadata */}
                                            <div className="metadata-grid">
                                                <div className="metadata-item">
                                                    <div className="metadata-label">Document ID</div>
                                                    <div className="metadata-value">
                                                        {result.document.documentId.slice(0, 8)}…
                                                    </div>
                                                </div>
                                                <div className="metadata-item">
                                                    <div className="metadata-label">MIME Type</div>
                                                    <div className="metadata-value">
                                                        {result.document.mimeType}
                                                    </div>
                                                </div>
                                                {Object.entries(result.document.metadata).map(
                                                    ([key, val]) => (
                                                        <div key={key} className="metadata-item">
                                                            <div className="metadata-label">{key}</div>
                                                            <div className="metadata-value">
                                                                {typeof val === "object"
                                                                    ? JSON.stringify(val)
                                                                    : String(val)}
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>

                                            {/* Chunks */}
                                            <div className="chunks-header">
                                                <h4>Content Chunks</h4>
                                                <span className="chunks-count">
                                                    {result.document.chunks.length}
                                                </span>
                                            </div>
                                            <div className="chunk-list">
                                                {result.document.chunks.map((chunk, ci) => (
                                                    <div key={chunk.id || ci} className="chunk-card">
                                                        <div className="chunk-meta">
                                                            <span
                                                                className={`chunk-type-badge ${chunk.type}`}
                                                            >
                                                                {chunk.type}
                                                            </span>
                                                            {chunk.page && (
                                                                <span className="chunk-page">
                                                                    Page {chunk.page}
                                                                </span>
                                                            )}
                                                            {chunk.section && (
                                                                <span className="chunk-page">
                                                                    {chunk.section}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="chunk-text">
                                                            {chunk.text.length > 500
                                                                ? chunk.text.slice(0, 500) + "…"
                                                                : chunk.text}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="error-message">Error: {result.error}</div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
