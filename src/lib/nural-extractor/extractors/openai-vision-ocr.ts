import OpenAI from "openai";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import type { OcrProvider } from "../types";

interface OpenAIVisionOcrOptions {
    apiKey?: string;
    model?: string;
    prompt?: string;
}

const DEFAULT_PROMPT =
    "You are an OCR engine. Read every word in the image and return plain text with natural line breaks.";

export class OpenAIVisionOcrProvider implements OcrProvider {
    private readonly client: OpenAI;
    private readonly model: string;
    private readonly prompt: string;

    constructor(options: OpenAIVisionOcrOptions = {}) {
        const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error(
                "[OpenAIVisionOcrProvider] Missing OPENAI_API_KEY. Pass it via options or environment variable."
            );
        }

        this.client = new OpenAI({ apiKey });
        this.model = options.model ?? "gpt-4.1-mini";
        this.prompt = options.prompt ?? DEFAULT_PROMPT;
    }

    async recognize(imageBuffer: Buffer): Promise<string> {
        try {
            const base64 = imageBuffer.toString("base64");
            const response = await this.client.responses.create({
                model: this.model,
                input: [
                    {
                        role: "user",
                        content: [
                            { type: "input_text", text: this.prompt },
                            {
                                type: "input_image",
                                image_url: `data:image/png;base64,${base64}`,
                                detail: "high",
                            },
                        ],
                    },
                ],
            });

            const text = this.collectText(response);
            return text.trim();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[OpenAIVisionOcrProvider] OCR failed: ${message}`);
            return `[OCR Error] ${message}`;
        }
    }

    private collectText(response: OpenAIResponse): string {
        if (Array.isArray(response.output_text) && response.output_text.length > 0) {
            return response.output_text.join("\n");
        }

        for (const item of response.output ?? []) {
            if (item.type !== "message") {
                continue;
            }

            for (const content of item.content) {
                if (content.type === "output_text") {
                    return content.text ?? "";
                }
            }
        }

        return "";
    }
}
