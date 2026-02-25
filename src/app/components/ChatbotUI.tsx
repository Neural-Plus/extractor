"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  contextTag?: string;
};

type LoadedFile = {
  id: string;
  name: string;
  content: string;
  selectedParts: string[];
};

const SUPPORTED_EXTENSIONS = ["txt", "doc", "docx"];
const VIEWER_PREVIEW_LIMIT = 10000;
const CONTEXT_LIMIT = 22000;

function normalizeContent(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

async function parseTextFromFile(file: File): Promise<string> {
  const extension = fileExtension(file.name);

  if (extension === "txt") {
    return normalizeContent(await file.text());
  }

  if (extension === "doc" || extension === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return normalizeContent(result.value ?? "");
  }

  throw new Error(`Unsupported file type: .${extension || "unknown"}`);
}

export default function ChatbotUI() {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewerRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const activeFile = useMemo(
    () => files.find((file) => file.id === activeFileId) ?? null,
    [files, activeFileId]
  );

  const isExpanded = useMemo(
    () => (activeFile ? expandedFiles.has(activeFile.id) : false),
    [activeFile, expandedFiles]
  );

  const displayedContent = useMemo(() => {
    if (!activeFile) return "";
    if (isExpanded || activeFile.content.length <= VIEWER_PREVIEW_LIMIT) {
      return activeFile.content;
    }

    return `${activeFile.content.slice(0, VIEWER_PREVIEW_LIMIT)}\n\n[Preview truncated. Click "Show full" to view all.]`;
  }, [activeFile, isExpanded]);

  const allSelections = useMemo(
    () =>
      files.flatMap((file) =>
        file.selectedParts.map((text, index) => ({
          fileId: file.id,
          fileName: file.name,
          index,
          text,
        }))
      ),
    [files]
  );

  const contextLabel = useMemo(() => {
    if (allSelections.length > 0) {
      const fileCount = new Set(allSelections.map((item) => item.fileId)).size;
      const totalChars = allSelections.reduce((sum, item) => sum + item.text.length, 0);
      return `${allSelections.length} selections from ${fileCount} file(s) · ${Math.min(totalChars, CONTEXT_LIMIT)} chars used`;
    }

    if (activeFile) {
      return `${activeFile.name} full file · ${Math.min(activeFile.content.length, CONTEXT_LIMIT)} chars used`;
    }

    return "No context selected";
  }, [allSelections, activeFile]);

  const setFileSelections = useCallback((fileId: string, selectedParts: string[]) => {
    setFiles((prev) =>
      prev.map((file) => (file.id === fileId ? { ...file, selectedParts } : file))
    );
  }, []);

  const captureSelection = useCallback((): string | null => {
    if (!activeFile || !viewerRef.current) return null;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!viewerRef.current.contains(range.commonAncestorContainer)) return null;

    const text = selection.toString().trim();
    return text || null;
  }, [activeFile]);

  const addHighlightedPart = useCallback(() => {
    if (!activeFile) return;

    const text = captureSelection();
    if (!text) {
      setError("Highlight text in the document viewer first.");
      return;
    }

    if (activeFile.selectedParts.includes(text)) {
      setError("That selection is already added for this file.");
      return;
    }

    setFileSelections(activeFile.id, [...activeFile.selectedParts, text]);
    setError(null);
  }, [activeFile, captureSelection, setFileSelections]);

  const removeSelection = useCallback(
    (fileId: string, indexToRemove: number) => {
      const file = files.find((item) => item.id === fileId);
      if (!file) return;
      const next = file.selectedParts.filter((_, index) => index !== indexToRemove);
      setFileSelections(fileId, next);
    },
    [files, setFileSelections]
  );

  const clearAllSelections = useCallback(() => {
    setFiles((prev) => prev.map((file) => ({ ...file, selectedParts: [] })));
  }, []);

  const removeFile = useCallback(
    (fileId: string) => {
      setFiles((prev) => {
        const next = prev.filter((file) => file.id !== fileId);
        if (activeFileId === fileId) {
          setActiveFileId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });

      setExpandedFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    },
    [activeFileId]
  );

  const toggleExpand = useCallback(() => {
    if (!activeFile) return;
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(activeFile.id)) next.delete(activeFile.id);
      else next.add(activeFile.id);
      return next;
    });
  }, [activeFile]);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const incoming = event.target.files;
      if (!incoming || incoming.length === 0) return;

      setLoadingFiles(true);
      setError(null);

      const allowed = Array.from(incoming).filter((file) =>
        SUPPORTED_EXTENSIONS.includes(fileExtension(file.name))
      );

      if (allowed.length === 0) {
        setError("Select at least one .txt, .doc, or .docx file.");
        setLoadingFiles(false);
        event.target.value = "";
        return;
      }

      try {
        const parsed = await Promise.all(
          allowed.map(async (file) => ({
            id: `${file.name}-${file.size}-${file.lastModified}`,
            name: file.name,
            content: await parseTextFromFile(file),
            selectedParts: [],
          }))
        );

        setFiles((prev) => {
          const existing = new Set(prev.map((item) => item.id));
          const deduped = parsed.filter((item) => !existing.has(item.id));
          const next = [...prev, ...deduped];
          if (!activeFileId && next.length > 0) setActiveFileId(next[0].id);
          return next;
        });
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Could not parse selected files.");
      } finally {
        setLoadingFiles(false);
        event.target.value = "";
      }
    },
    [activeFileId]
  );

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || isAsking) return;

    const hasSelections = allSelections.length > 0;

    if (!hasSelections && !activeFile) {
      setError("Upload and select at least one file first.");
      return;
    }

    const rawContext = hasSelections
      ? allSelections
          .map(
            (item, index) =>
              `[File: ${item.fileName} | Part ${item.index + 1} | Global ${index + 1}]\n${item.text}`
          )
          .join("\n\n")
      : (activeFile?.content ?? "");

    const context = rawContext.slice(0, CONTEXT_LIMIT);

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: question,
      contextTag: hasSelections
        ? `${allSelections.length} selections from ${new Set(allSelections.map((s) => s.fileId)).size} files${
            rawContext.length > CONTEXT_LIMIT ? " (trimmed)" : ""
          }`
        : `${activeFile?.name ?? "No file"} full file${rawContext.length > CONTEXT_LIMIT ? " (trimmed)" : ""}`,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setError(null);
    setIsAsking(true);

    try {
      const response = await fetch("/api/chat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context }),
      });

      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) {
        throw new Error(data.error || "Failed to get response from LLM.");
      }

      const botMsg: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: data.answer,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "LLM request failed.";
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant-error`,
          role: "assistant",
          text: `I couldn't reach the LLM right now: ${message}`,
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  }, [activeFile, allSelections, input, isAsking]);

  const onComposerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      <nav className="extractor-nav">
        <Link href="/" className="landing-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/neural+_inspiration-removebg-preview.png"
            alt="Neural+"
            width={48}
            height={48}
            className="landing-logo-img"
          />
          <span className="landing-logo-text">Neural+</span>
        </Link>
      </nav>

      <div className="app-container chat-v2-container">
        <header className="header chat-v2-hero">
          <div className="header-badge">
            <span className="header-badge-dot" />
            CONTEXT CHAT WORKSPACE
          </div>
          <h1>
            Multi-File <span className="header-gradient">Context Chat</span>
          </h1>
          <p>
            Upload one or more files, highlight the exact text you want to use,
            then ask your question to chat with only that selected context.
          </p>
        </header>

        <section className="chat-v2-workspace">
          <aside className="chat-v2-files">
            <label className="chat-v2-upload" htmlFor="chat-file-input">
              {loadingFiles ? "Reading files..." : "Add Files"}
            </label>
            <input
              id="chat-file-input"
              type="file"
              accept=".txt,.doc,.docx"
              multiple
              onChange={handleFileUpload}
              className="chat-file-input"
            />

            <div className="chat-v2-file-list">
              {files.map((file) => (
                <div key={file.id} className={`chat-v2-file-item ${activeFileId === file.id ? "active" : ""}`}>
                  <button type="button" className="chat-v2-file-open" onClick={() => setActiveFileId(file.id)}>
                    <span>{file.name}</span>
                    <small>{file.selectedParts.length} parts</small>
                  </button>
                  <button
                    type="button"
                    className="chat-v2-file-delete"
                    onClick={() => removeFile(file.id)}
                    aria-label={`Delete ${file.name}`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </aside>

          <section className="chat-v2-viewer">
            <div className="chat-v2-viewer-head">
              <h3>{activeFile ? activeFile.name : "No file selected"}</h3>
              <div className="chat-v2-actions">
                <button type="button" onClick={addHighlightedPart} disabled={!activeFile || isAsking}>
                  Add Highlight
                </button>
                <button
                  type="button"
                  onClick={toggleExpand}
                  disabled={!activeFile || activeFile.content.length <= VIEWER_PREVIEW_LIMIT}
                >
                  {isExpanded ? "Show preview" : "Show full"}
                </button>
              </div>
            </div>

            <div ref={viewerRef} className="chat-v2-viewer-body">
              {activeFile ? <pre>{displayedContent}</pre> : <p>Select a file to view content.</p>}
            </div>
          </section>

          <aside className="chat-v2-context">
            <div className="chat-v2-context-head">
              <h3>Context Basket</h3>
              <button type="button" onClick={clearAllSelections} disabled={allSelections.length === 0 || isAsking}>
                Clear all
              </button>
            </div>

            <div className="chat-v2-context-summary">{contextLabel}</div>

            <div className="chat-v2-context-list">
              {allSelections.length === 0 ? (
                <p>No selections yet.</p>
              ) : (
                allSelections.map((item) => (
                  <div key={`${item.fileId}-${item.index}`} className="chat-v2-context-item">
                    <strong>{item.fileName}</strong>
                    <span>{item.text.slice(0, 120)}{item.text.length > 120 ? "…" : ""}</span>
                    <button
                      type="button"
                      onClick={() => removeSelection(item.fileId, item.index)}
                      disabled={isAsking}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>
        </section>

        <section className="chat-v2-chat">
          <div className="chat-v2-messages">
            {messages.length === 0 ? (
              <p className="chat-placeholder">
                Select highlights from one or more files, then ask your question.
              </p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`chat-v2-msg-row ${message.role}`}>
                  <div className={`chat-v2-msg ${message.role}`}>
                    <div className="chat-v2-msg-role">{message.role === "user" ? "You" : "Bot"}</div>
                    {message.contextTag && <div className="chat-context-tag">Context: {message.contextTag}</div>}
                    <p>{message.text}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messageEndRef} />
          </div>

          <div className="chat-v2-composer">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder="Ask using selected context..."
              rows={3}
              disabled={isAsking}
            />
            <button type="button" onClick={handleSend} disabled={!input.trim() || isAsking}>
              {isAsking ? "Thinking..." : "Send"}
            </button>
          </div>
        </section>

        {error && <p className="chat-error">{error}</p>}
      </div>
    </>
  );
}
