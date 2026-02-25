import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = "gpt-4o-mini";

interface AskRequestBody {
  question?: string;
  context?: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AskRequestBody;
    const question = body.question?.trim();
    const context = body.context?.trim();

    if (!question) {
      return NextResponse.json({ error: "Missing question." }, { status: 400 });
    }

    if (!context) {
      return NextResponse.json({ error: "Missing context." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set." },
        { status: 500 }
      );
    }

    const trimmedApiKey = apiKey.trim();
    if (
      trimmedApiKey.includes("your_openai_api_key_here") ||
      trimmedApiKey.startsWith("your_")
    ) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is still a placeholder. Update .env.local with a real key and restart the dev server.",
        },
        { status: 500 }
      );
    }

    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

    const llmResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${trimmedApiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant for document Q&A. Use only the provided context. If the answer is not in context, clearly say that.",
          },
          {
            role: "user",
            content: `Context:\n${context}\n\nQuestion:\n${question}`,
          },
        ],
      }),
    });

    const data = (await llmResponse.json()) as OpenAIChatResponse;

    if (!llmResponse.ok) {
      const message = data.error?.message || "LLM provider request failed.";
      return NextResponse.json({ error: message }, { status: llmResponse.status });
    }

    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return NextResponse.json(
        { error: "LLM returned an empty response." },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer, model }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: "Method not allowed. Use POST.",
      usage: {
        method: "POST",
        path: "/api/chat/ask",
        body: {
          question: "string",
          context: "string",
        },
      },
    },
    { status: 405 }
  );
}
