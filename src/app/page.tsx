import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="landing">
      {/* ── Ambient background effects ── */}
      <div className="landing-glow landing-glow-1" />
      <div className="landing-glow landing-glow-2" />
      <div className="landing-grid-bg" />

      {/* ── Navigation ── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <Image src="/neural+_inspiration-removebg-preview.png" alt="Neural+" width={36} height={36} className="landing-logo-img" />
            <span className="landing-logo-text">Neural+</span>
          </div>
          <div className="nav-links">
            <Link href="/contact" className="nav-link">
              Contact
            </Link>
            <Link href="/extract" className="nav-cta">
              Launch App →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          NEURAL+ EXTRACTION ENGINE v2.4
        </div>

        <h1 className="hero-title">
          Extract. Structure.
          <br />
          <span className="hero-title-gradient">Transform.</span>
        </h1>

        <p className="hero-subtitle">
          Turn any document into clean, structured data ready for LLMs and AI
          pipelines. Upload PDFs, Word docs, spreadsheets, presentations, images
          — and get normalized, chunked content in seconds.
        </p>

        <div className="hero-actions">
          <Link href="/extract" className="hero-btn-primary">
            <span className="hero-btn-icon">🚀</span>
            Start Extracting
          </Link>
          <a href="#features" className="hero-btn-secondary">
            See How It Works
          </a>
        </div>

        {/* ── Format pills ── */}
        <div className="hero-formats">
          {[
            { label: "PDF", color: "#ff5c6a" },
            { label: "DOCX", color: "#4285f4" },
            { label: "XLSX", color: "#34a853" },
            { label: "CSV", color: "#00d4aa" },
            { label: "PPTX", color: "#ff9800" },
            { label: "HTML", color: "#ff5722" },
            { label: "Images", color: "#ce93d8" },
          ].map((fmt) => (
            <span
              key={fmt.label}
              className="hero-format-pill"
              style={
                {
                  "--pill-color": fmt.color,
                } as React.CSSProperties
              }
            >
              {fmt.label}
            </span>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="landing-features">
        <h2 className="features-title">
          Everything You Need for
          <span className="features-title-accent"> Document AI</span>
        </h2>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📄</div>
            <h3>Multi-Format Ingestion</h3>
            <p>
              Upload PDFs, Word, Excel, CSV, PowerPoint, HTML, and images. All
              parsed natively — no external services needed.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>OCR Built In</h3>
            <p>
              Extract text from images and scanned documents using Tesseract.js
              OCR, running entirely server-side.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🧩</div>
            <h3>Structured Chunks</h3>
            <p>
              Content is broken into typed chunks — headings, paragraphs,
              tables, lists — with page numbers and section labels.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">✨</div>
            <h3>Smart Normalization</h3>
            <p>
              Automatic whitespace cleanup, artifact removal, and text
              standardization for consistent, clean output.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3>Export Anywhere</h3>
            <p>
              Download results as JSON, plain text, or Markdown. Ready for
              RAG systems, fine-tuning datasets, or any AI pipeline.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Parallel Processing</h3>
            <p>
              Upload multiple files at once. Each is processed concurrently with
              graceful per-file error handling.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="landing-cta">
        <div className="cta-card">
          <h2>Ready to extract?</h2>
          <p>
            No sign-up needed. Upload your documents and get structured output
            instantly.
          </p>
          <Link href="/extract" className="hero-btn-primary">
            <span className="hero-btn-icon">🚀</span>
            Open Extractor
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <p>
          Built with Next.js · Powered by Nural+ Extractor Engine
        </p>
      </footer>
    </div>
  );
}
