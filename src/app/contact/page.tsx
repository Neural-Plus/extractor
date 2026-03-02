"use client";

import { useState } from "react";
import Link from "next/link";

export default function ContactPage() {
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSending(true);
        setError("");

        const form = e.currentTarget;
        const data = new FormData(form);

        const name = data.get("name") as string;
        const email = data.get("email") as string;
        const subject = data.get("subject") as string;
        const message = data.get("message") as string;

        const htmlBody = `
      <div style="font-family:sans-serif;color:#333;">
        <h2 style="color:#8264ff;">✉️ Contact — Nural+</h2>
        <table style="border-collapse:collapse;width:100%;max-width:500px;">
          <tr><td style="padding:8px 12px;font-weight:bold;color:#666;">Name</td><td style="padding:8px 12px;">${name}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:bold;color:#666;">Email</td><td style="padding:8px 12px;">${email}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:bold;color:#666;">Subject</td><td style="padding:8px 12px;">${subject}</td></tr>
        </table>
        <h3 style="margin-top:20px;color:#555;">Message</h3>
        <p style="background:#f5f5f5;padding:16px;border-radius:8px;white-space:pre-wrap;">${message}</p>
      </div>
    `;

        try {
            const response = await fetch(
                "https://mail-api-gamma.vercel.app/api/send-email",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        to: "contact@nural.dev",
                        subject: `[Nural+ Contact] ${subject}`,
                        message: htmlBody,
                        isHtml: true,
                    }),
                }
            );

            const result = await response.json();

            if (response.ok) {
                setSent(true);
                form.reset();
            } else {
                setError(result.message || "Failed to send message.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Network error");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="contact-page">
            {/* ── Background Effects ── */}
            <div className="landing-glow landing-glow-1" />
            <div className="landing-glow landing-glow-2" />

            {/* ── Nav ── */}
            <nav className="landing-nav">
                <div className="landing-nav-inner">
                    <Link href="/" className="landing-logo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/neural+_inspiration-removebg-preview.png" alt="Neural+" width={36} height={36} className="landing-logo-img" />
                        <span className="landing-logo-text">Neural+</span>
                    </Link>
                    <div className="nav-links">
                        <Link href="/docs" className="nav-link">
                            API Docs
                        </Link>
                        <Link href="/extract" className="nav-cta">
                            Launch App →
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Contact Form ── */}
            <section className="contact-section">
                <div className="contact-header">
                    <div className="hero-badge">
                        <span className="hero-badge-dot" />
                        Get in Touch
                    </div>
                    <h1 className="contact-title">Contact Us</h1>
                    <p className="contact-subtitle">
                        Have a question, feature request, or partnership inquiry? We&apos;d love
                        to hear from you.
                    </p>
                </div>

                {sent ? (
                    <div className="contact-success-card">
                        <div className="contact-success-icon">✓</div>
                        <h2>Message Sent!</h2>
                        <p>Thank you for reaching out. We&apos;ll get back to you shortly.</p>
                        <button
                            className="hero-btn-primary"
                            onClick={() => setSent(false)}
                        >
                            Send Another Message
                        </button>
                    </div>
                ) : (
                    <form className="contact-form" onSubmit={handleSubmit}>
                        <div className="contact-form-grid">
                            <div className="contact-field">
                                <label htmlFor="contact-name">Name</label>
                                <input
                                    id="contact-name"
                                    name="name"
                                    type="text"
                                    placeholder="Your full name"
                                    required
                                />
                            </div>

                            <div className="contact-field">
                                <label htmlFor="contact-email">Email</label>
                                <input
                                    id="contact-email"
                                    name="email"
                                    type="email"
                                    placeholder="your.email@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="contact-field">
                            <label htmlFor="contact-subject">Subject</label>
                            <input
                                id="contact-subject"
                                name="subject"
                                type="text"
                                placeholder="What is this about?"
                                required
                            />
                        </div>

                        <div className="contact-field">
                            <label htmlFor="contact-message">Message</label>
                            <textarea
                                id="contact-message"
                                name="message"
                                rows={6}
                                placeholder="Tell us more…"
                                required
                            />
                        </div>

                        {error && <p className="contact-error">{error}</p>}

                        <button
                            type="submit"
                            className="hero-btn-primary contact-submit"
                            disabled={sending}
                        >
                            {sending ? "Sending…" : "Send Message"}
                        </button>
                    </form>
                )}
            </section>
        </div>
    );
}
