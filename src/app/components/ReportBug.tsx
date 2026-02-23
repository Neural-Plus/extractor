"use client";

import { useState, useRef } from "react";

export default function ReportBug() {
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");
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
            setError("Please describe the bug.");
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
          <h2 style="color:#8264ff;">🐛 Bug Report — Neural+</h2>
          <table style="border-collapse:collapse;width:100%;max-width:500px;">
            <tr><td style="padding:8px 12px;font-weight:bold;color:#666;">Name</td><td style="padding:8px 12px;">${name || "Anonymous"}</td></tr>
            <tr><td style="padding:8px 12px;font-weight:bold;color:#666;">Email</td><td style="padding:8px 12px;">${email || "Not provided"}</td></tr>
          </table>
          <h3 style="margin-top:20px;color:#555;">Description</h3>
          <p style="background:#f5f5f5;padding:16px;border-radius:8px;white-space:pre-wrap;">${desc}</p>
          ${imageUrl ? `<h3 style="margin-top:20px;color:#555;">Screenshot</h3><img src="${imageUrl}" alt="Bug screenshot" style="max-width:100%;border-radius:8px;border:1px solid #ddd;" />` : ""}
        </div>
      `;

            const response = await fetch(
                "https://mail-api-gamma.vercel.app/api/send-email",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        to: "akramlitniti4@gmail.com",
                        subject: `[Bug Report] ${desc.slice(0, 60)}${desc.length > 60 ? "…" : ""}`,
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
                setError(result.message || "Failed to send report.");
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
                    <path d="M22 2 11 13" />
                    <path d="m22 2-7 20-4-9-9-4 20-7z" />
                </svg>
                Report a Bug
            </button>

            {/* ── Modal Overlay ── */}
            {open && (
                <div className="bug-overlay" onClick={handleClose}>
                    <div className="bug-modal" onClick={(e) => e.stopPropagation()}>
                        {sent ? (
                            <div className="bug-success">
                                <div className="bug-success-icon">✓</div>
                                <h3>Report Sent!</h3>
                                <p>Thank you for your feedback. We&apos;ll look into it.</p>
                                <button className="bug-btn-close" onClick={handleClose}>
                                    Close
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="bug-modal-header">
                                    <h3>Report a Bug</h3>
                                    <div className="bug-header-icon">
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M22 2 11 13" />
                                            <path d="m22 2-7 20-4-9-9-4 20-7z" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Form */}
                                <div className="bug-form">
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

                                    <div className="bug-field">
                                        <label htmlFor="bug-desc">
                                            Description <span className="bug-required">(required)</span>
                                        </label>
                                        <textarea
                                            id="bug-desc"
                                            rows={5}
                                            placeholder="What's the bug? What did you expect?"
                                        />
                                    </div>

                                    {/* Screenshot */}
                                    <button
                                        className="bug-screenshot-btn"
                                        type="button"
                                        onClick={() => fileRef.current?.click()}
                                    >
                                        {screenshot ? `📎 ${screenshot.name}` : "Add a screenshot"}
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

                                    {error && <p className="bug-error">{error}</p>}

                                    <button
                                        className="bug-btn-submit"
                                        onClick={handleSubmit}
                                        disabled={sending}
                                    >
                                        {sending ? "Sending…" : "Send Bug Report"}
                                    </button>

                                    <button
                                        className="bug-btn-cancel"
                                        onClick={handleClose}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
