"use client";

import { useState, useRef } from "react";

type FeedbackCategory = "Bug" | "Idea" | "Praise";

export default function ReportBug() {
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");
    const [category, setCategory] = useState<FeedbackCategory>("Bug");
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async () => {
        const name = (document.getElementById("bug-name") as HTMLInputElement)
            ?.value;
        const email = (document.getElementById("bug-email") as HTMLInputElement)
            ?.value;
        const desc = (document.getElementById("bug-desc") as HTMLTextAreaElement)
            ?.value;

        if (!desc.trim()) {
            setError(`Please provide your ${category.toLowerCase()} description.`);
            return;
        }

        setSending(true);
        setError("");

        try {
            // Upload screenshot to ImgBB if present
            let imageUrl = "";
            if (screenshot) {
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = reader.result as string;
                        resolve(result.split(",")[1]); // strip data:... prefix
                    };
                    reader.readAsDataURL(screenshot);
                });

                const imgForm = new FormData();
                imgForm.append("key", "0315777197897fb5a769e9e2642d467a");
                imgForm.append("image", base64);
                imgForm.append("name", screenshot.name.replace(/\.[^.]+$/, ""));

                const imgRes = await fetch("https://api.imgbb.com/1/upload", {
                    method: "POST",
                    body: imgForm,
                });
                const imgData = await imgRes.json();

                if (imgData.success) {
                    imageUrl = imgData.data.url;
                }
            }

            // Build the HTML message body
            const htmlBody = `
        <div style="font-family:sans-serif;color:#333;">
          <h2 style="color:#8264ff;">✨ Quick Feedback — ${category}</h2>
          <table style="border-collapse:collapse;width:100%;max-width:500px;">
            <tr><td style="padding:8px 12px;font-weight:bold;color:#666;">Category</td><td style="padding:8px 12px;text-transform:uppercase;font-weight:bold;color:#8264ff;">${category}</td></tr>
            <tr><td style="padding:8px 12px;font-weight:bold;color:#666;">Name</td><td style="padding:8px 12px;">${name || "Anonymous"}</td></tr>
            <tr><td style="padding:8px 12px;font-weight:bold;color:#666;">Email</td><td style="padding:8px 12px;">${email || "Not provided"}</td></tr>
          </table>
          <h3 style="margin-top:20px;color:#555;">Details</h3>
          <p style="background:#f5f5f5;padding:16px;border-radius:8px;white-space:pre-wrap;">${desc}</p>
          ${imageUrl ? `<h3 style="margin-top:20px;color:#555;">Screenshot</h3><img src="${imageUrl}" alt="Feedback screenshot" style="max-width:100%;border-radius:8px;border:1px solid #ddd;" />` : ""}
        </div>
      `;

            const response = await fetch(
                "https://mail-api-gamma.vercel.app/api/send-email",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        to: "akramlitniti4@gmail.com",
                        subject: `[${category} Feedback] ${desc.slice(0, 60)}${desc.length > 60 ? "…" : ""}`,
                        message: htmlBody,
                        isHtml: true,
                        ...(imageUrl ? { attachments: [{ path: imageUrl }] } : {}),
                    }),
                }
            );

            const result = await response.json();

            if (response.ok) {
                setSent(true);
            } else {
                setError(result.message || "Failed to send feedback.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Network error");
        } finally {
            setSending(false);
        }
    };

    const handleClose = () => {
        setOpen(false);
        setSent(false);
        setError("");
        setScreenshot(null);
        setCategory("Bug");
    };

    return (
        <>
            {/* ── Floating Trigger Button ── */}
            <button className="bug-trigger" onClick={() => setOpen(true)}>
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Quick Feedback
            </button>

            {/* ── Modal Overlay ── */}
            {open && (
                <div className="bug-overlay" onClick={handleClose}>
                    <div className="bug-modal" onClick={(e) => e.stopPropagation()}>
                        {sent ? (
                            <div className="bug-success">
                                <div className="bug-success-icon">✓</div>
                                <h3>Feedback Sent!</h3>
                                <p>Thank you for helping us improve Neural+ Extractor.</p>
                                <button className="bug-btn-close" onClick={handleClose}>
                                    Close
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="bug-modal-header">
                                    <div>
                                        <h3>Quick Feedback</h3>
                                        <p className="bug-modal-subtitle">Help us improve Neural+ Extractor</p>
                                    </div>
                                    <button className="bug-close-x" onClick={handleClose}>×</button>
                                </div>

                                {/* Category Selector */}
                                <div className="feedback-categories">
                                    <button
                                        className={`category-btn ${category === "Bug" ? "active" : ""}`}
                                        onClick={() => setCategory("Bug")}
                                    >
                                        <span className="cat-icon">⚠️</span>
                                        <span className="cat-label">Bug</span>
                                    </button>
                                    <button
                                        className={`category-btn ${category === "Idea" ? "active" : ""}`}
                                        onClick={() => setCategory("Idea")}
                                    >
                                        <span className="cat-icon">💡</span>
                                        <span className="cat-label">Idea</span>
                                    </button>
                                    <button
                                        className={`category-btn ${category === "Praise" ? "active" : ""}`}
                                        onClick={() => setCategory("Praise")}
                                    >
                                        <span className="cat-icon">😊</span>
                                        <span className="cat-label">Praise</span>
                                    </button>
                                </div>

                                {/* Form */}
                                <div className="bug-form">
                                    <div className="bug-field-row">
                                        <div className="bug-field">
                                            <label htmlFor="bug-name">Name</label>
                                            <input
                                                id="bug-name"
                                                type="text"
                                                placeholder="Your Name"
                                            />
                                        </div>
                                        <div className="bug-field">
                                            <label htmlFor="bug-email">Email</label>
                                            <input
                                                id="bug-email"
                                                type="email"
                                                placeholder="your.email@example.org"
                                            />
                                        </div>
                                    </div>

                                    <div className="bug-field">
                                        <label htmlFor="bug-desc">
                                            {category} Description <span className="bug-required">(required)</span>
                                        </label>
                                        <textarea
                                            id="bug-desc"
                                            rows={4}
                                            placeholder={
                                                category === "Bug"
                                                    ? "What went wrong?"
                                                    : category === "Idea"
                                                        ? "What would you like to see?"
                                                        : "What do you like about the app?"
                                            }
                                        />
                                    </div>

                                    {/* Screenshot */}
                                    <div className="bug-actions-row">
                                        <button
                                            className="bug-screenshot-btn"
                                            type="button"
                                            onClick={() => fileRef.current?.click()}
                                        >
                                            {screenshot ? `📎 ${screenshot.name.slice(0, 15)}...` : "Add screenshot"}
                                        </button>
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                            onChange={(e) =>
                                                setScreenshot(e.target.files?.[0] ?? null)
                                            }
                                        />
                                    </div>

                                    {error && <p className="bug-error">{error}</p>}

                                    <div className="bug-footer-btns">
                                        <button
                                            className="bug-btn-submit"
                                            onClick={handleSubmit}
                                            disabled={sending}
                                        >
                                            {sending ? "Sending…" : "Send Feedback"}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
