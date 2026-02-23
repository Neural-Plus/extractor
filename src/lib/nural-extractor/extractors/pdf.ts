import sharp from "sharp";
import pdfParse from "pdf-parse";
import {
    PDFArray,
    PDFContentStream,
    PDFDict,
    PDFDocument,
    PDFName,
    PDFNumber,
    PDFPage,
    PDFRawStream,
    PDFStream,
    decodePDFRawStream,
} from "pdf-lib";
import { v4 as uuidv4 } from "uuid";
import { OpenAIVisionOcrProvider } from "./openai-vision-ocr";
import { TesseractOcrProvider } from "./ocr-provider";
import type {
    ContentChunk,
    ExtractedDocument,
    Extractor,
    OcrProvider,
} from "../types";

const SUPPORTED_TYPES = ["application/pdf"];

type ColorSpaceKind = "DeviceRGB" | "DeviceGray" | "DeviceCMYK";
type PdfJsTextItem = { str?: string; hasEOL?: boolean };

export class PdfExtractor implements Extractor {
    readonly name = "PdfExtractor";

    private ocrProvider: OcrProvider | null;

    constructor(options?: { ocrProvider?: OcrProvider }) {
        this.ocrProvider = options?.ocrProvider ?? null;
    }

    supports(mimeType: string): boolean {
        return SUPPORTED_TYPES.includes(mimeType);
    }

    async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
        const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const pages = pdf.getPages();
        const chunks: ContentChunk[] = [];
        const imageOcrPages: number[] = [];
        const pageTexts = await this.extractTextPages(buffer, pages.length);

        for (let index = 0; index < pages.length; index++) {
            const page = pages[index];
            const pageNumber = index + 1;

            let text = pageTexts[index]?.trim() ?? "";
            if (!text) {
                text = this.extractPageText(page).trim();
            }

            const pageChunks = text ? this.chunkPageText(text, pageNumber) : [];
            if (pageChunks.length > 0) {
                chunks.push(...pageChunks);
            }

            const imageTexts = await this.extractImageTexts(page);
            if (imageTexts.length > 0) {
                imageOcrPages.push(pageNumber);
                imageTexts.forEach((imageText, imageIndex) => {
                    chunks.push({
                        id: "",
                        type: "image",
                        text: imageText,
                        page: pageNumber,
                        section: `image-${imageIndex + 1}`,
                    });
                });
            }
        }

        return {
            documentId: uuidv4(),
            fileName,
            mimeType: "application/pdf",
            metadata: {
                pageCount: pages.length,
                imageOcrPages,
            },
            chunks,
        };
    }

    private async extractTextPages(buffer: Buffer, expectedPages: number): Promise<string[]> {
        try {
            const pageTexts: string[] = [];

            await pdfParse(buffer, {
                pagerender: async (pageData: unknown) => {
                    if (!pageData || typeof (pageData as { getTextContent: unknown }).getTextContent !== "function") {
                        return "";
                    }

                    const textContent = await (pageData as { getTextContent: () => Promise<{ items: PdfJsTextItem[] }> }).getTextContent();
                    const raw = textContent.items
                        .map((item) => {
                            if (!item.str) {
                                return "";
                            }
                            return item.hasEOL ? `${item.str}\n` : item.str;
                        })
                        .join(" ");

                    const normalized = raw
                        .replace(/\s+\n/g, "\n")
                        .replace(/[ \t]+/g, " ")
                        .replace(/\n{3,}/g, "\n\n")
                        .trim();

                    pageTexts.push(normalized);
                    return normalized;
                },
                max: 0,
            });

            if (pageTexts.length < expectedPages) {
                return pageTexts.concat(Array.from({ length: expectedPages - pageTexts.length }, () => ""));
            }

            return pageTexts;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[PdfExtractor] pdf-parse text extraction failed: ${message}`);
            return Array.from({ length: expectedPages }, () => "");
        }
    }

    private chunkPageText(text: string, page: number): ContentChunk[] {
        const normalized = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .join("\n");

        if (!normalized) {
            return [];
        }

        const paragraphs = normalized
            .split(/\n{2,}/)
            .map((block) => block.replace(/\s+/g, " ").trim())
            .filter(Boolean);

        if (paragraphs.length === 0) {
            return [
                {
                    id: "",
                    type: "paragraph",
                    text: normalized,
                    page,
                },
            ];
        }

        return paragraphs.map((paragraph) => ({
            id: "",
            type: this.isHeading(paragraph) ? "heading" : "paragraph",
            text: paragraph,
            page,
        }));
    }

    private isHeading(text: string): boolean {
        return text.length < 120 && text === text.toUpperCase() && !/\d{4,}/.test(text);
    }

    private extractPageText(page: PDFPage): string {
        const streams = this.getContentStreams(page);
        if (streams.length === 0) {
            return "";
        }

        const tokens: string[] = [];
        for (const stream of streams) {
            const content = this.decodeStream(stream);
            tokens.push(...this.extractStrings(content));
        }

        return tokens
            .map((token) => token.replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .join("\n");
    }

    private getContentStreams(page: PDFPage): PDFStream[] {
        const contents = page.node.Contents();
        if (!contents) {
            return [];
        }

        if (contents instanceof PDFArray) {
            const streams: PDFStream[] = [];
            for (let index = 0; index < contents.size(); index++) {
                const stream = contents.lookupMaybe(index, PDFStream);
                if (stream) {
                    streams.push(stream);
                }
            }
            return streams;
        }

        if (contents instanceof PDFStream) {
            return [contents];
        }

        return [];
    }

    private decodeStream(stream: PDFStream): string {
        if (stream instanceof PDFContentStream) {
            return Buffer.from(stream.getUnencodedContents()).toString("latin1");
        }

        if (stream instanceof PDFRawStream) {
            try {
                const decoded = decodePDFRawStream(stream).decode();
                return Buffer.from(decoded).toString("latin1");
            } catch {
                return Buffer.from(stream.getContents()).toString("latin1");
            }
        }

        return Buffer.from(stream.getContents()).toString("latin1");
    }

    private extractStrings(content: string): string[] {
        const results: string[] = [];
        let index = 0;

        while (index < content.length) {
            const char = content[index];

            if (char === "(") {
                const literal = this.readLiteralString(content, index);
                index = literal.nextIndex;
                const operator = this.readOperator(content, index);
                index = operator.nextIndex;
                if (this.isSimpleTextOperator(operator.name)) {
                    results.push(literal.text);
                }
                continue;
            }

            if (char === "<" && content[index + 1] !== "<") {
                const hex = this.readHexString(content, index);
                index = hex.nextIndex;
                const operator = this.readOperator(content, index);
                index = operator.nextIndex;
                if (this.isSimpleTextOperator(operator.name)) {
                    results.push(hex.text);
                }
                continue;
            }

            if (char === "[") {
                const arrayContents = this.readTextArray(content, index);
                index = arrayContents.nextIndex;
                const operator = this.readOperator(content, index);
                index = operator.nextIndex;
                if (operator.name === "TJ" && arrayContents.items.length > 0) {
                    results.push(arrayContents.items.join(""));
                }
                continue;
            }

            index += 1;
        }

        return results;
    }

    private readLiteralString(content: string, start: number): { text: string; nextIndex: number } {
        const bytes: number[] = [];
        let depth = 1;
        let index = start + 1;

        while (index < content.length && depth > 0) {
            const char = content[index];

            if (char === "\\") {
                index += 1;
                if (index >= content.length) {
                    break;
                }

                const next = content[index];

                if (/[0-7]/.test(next)) {
                    let octal = next;
                    index += 1;
                    for (let i = 0; i < 2 && index < content.length; i += 1) {
                        const candidate = content[index];
                        if (/[0-7]/.test(candidate)) {
                            octal += candidate;
                            index += 1;
                        } else {
                            break;
                        }
                    }
                    bytes.push(parseInt(octal, 8));
                    continue;
                }

                switch (next) {
                    case "n":
                        bytes.push(0x0a);
                        break;
                    case "r":
                        bytes.push(0x0d);
                        break;
                    case "t":
                        bytes.push(0x09);
                        break;
                    case "b":
                        bytes.push(0x08);
                        break;
                    case "f":
                        bytes.push(0x0c);
                        break;
                    case "(":
                    case ")":
                    case "\\":
                        bytes.push(next.charCodeAt(0));
                        break;
                    case "\r":
                        if (content[index + 1] === "\n") {
                            index += 1;
                        }
                        break;
                    case "\n":
                        break;
                    default:
                        bytes.push(next.charCodeAt(0));
                        break;
                }

                index += 1;
                continue;
            }

            if (char === "(") {
                depth += 1;
                bytes.push(char.charCodeAt(0));
                index += 1;
                continue;
            }

            if (char === ")") {
                depth -= 1;
                index += 1;
                if (depth > 0) {
                    bytes.push(char.charCodeAt(0));
                }
                continue;
            }

            bytes.push(char.charCodeAt(0));
            index += 1;
        }

        return { text: this.decodeText(bytes), nextIndex: index };
    }

    private readHexString(content: string, start: number): { text: string; nextIndex: number } {
        let index = start + 1;
        let hex = "";

        while (index < content.length) {
            const char = content[index];
            if (char === ">") {
                index += 1;
                break;
            }
            if (!/\s/.test(char)) {
                hex += char;
            }
            index += 1;
        }

        if (hex.length % 2 === 1) {
            hex += "0";
        }

        const bytes: number[] = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.slice(i, i + 2), 16));
        }

        return { text: this.decodeText(bytes), nextIndex: index };
    }

    private readTextArray(content: string, start: number): { items: string[]; nextIndex: number } {
        const items: string[] = [];
        let index = start + 1;

        while (index < content.length) {
            const char = content[index];

            if (char === "]") {
                index += 1;
                break;
            }

            if (char === "(") {
                const literal = this.readLiteralString(content, index);
                items.push(literal.text);
                index = literal.nextIndex;
                continue;
            }

            if (char === "<" && content[index + 1] !== "<") {
                const hex = this.readHexString(content, index);
                items.push(hex.text);
                index = hex.nextIndex;
                continue;
            }

            index += 1;
        }

        return { items, nextIndex: index };
    }

    private readOperator(content: string, start: number): { name: string | null; nextIndex: number } {
        let index = start;
        while (index < content.length && /\s/.test(content[index])) {
            index += 1;
        }

        if (index >= content.length) {
            return { name: null, nextIndex: index };
        }

        const char = content[index];
        if (char === "'" || char === '"') {
            return { name: char, nextIndex: index + 1 };
        }

        let end = index;
        while (end < content.length && /[A-Za-z]/.test(content[end])) {
            end += 1;
        }

        if (end === index) {
            return { name: null, nextIndex: index + 1 };
        }

        return { name: content.slice(index, end), nextIndex: end };
    }

    private isSimpleTextOperator(name: string | null): boolean {
        return name === "Tj" || name === "'" || name === '"';
    }

    private decodeText(bytes: number[]): string {
        if (bytes.length === 0) {
            return "";
        }

        const buffer = Buffer.from(bytes);

        if (buffer.length >= 2) {
            const bom = (buffer[0] << 8) | buffer[1];
            if (bom === 0xfeff) {
                return buffer.slice(2).swap16().toString("utf16le");
            }
            if (bom === 0xfffe) {
                return buffer.slice(2).toString("utf16le");
            }
        }

        const utf8 = buffer.toString("utf8");
        if (utf8.includes("\ufffd")) {
            return buffer.toString("latin1");
        }
        return utf8;
    }

    private async extractImageTexts(page: PDFPage): Promise<string[]> {
        const resources = page.node.Resources();
        if (!resources) {
            return [];
        }

        const xObjects = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
        if (!xObjects) {
            return [];
        }

        const images: Buffer[] = [];
        for (const [key] of xObjects.entries()) {
            const stream = xObjects.lookupMaybe(key, PDFStream);
            if (!stream) {
                continue;
            }

            const subtype = stream.dict.lookupMaybe(PDFName.of("Subtype"), PDFName);
            if (!subtype || this.normalizeName(subtype) !== "Image") {
                continue;
            }

            const png = await this.convertImageStreamToPng(stream, resources);
            if (png) {
                images.push(png);
            }
        }

        if (images.length === 0) {
            return [];
        }

        const provider = this.getOrCreateOcrProvider();
        const results: string[] = [];

        for (const buffer of images) {
            const text = (await provider.recognize(buffer)).trim();
            if (text) {
                results.push(text);
            }
        }

        return results;
    }

    private async convertImageStreamToPng(stream: PDFStream, resources: PDFDict): Promise<Buffer | null> {
        const filterEntry =
            stream.dict.lookupMaybe(PDFName.of("Filter"), PDFName) ??
            stream.dict.lookupMaybe(PDFName.of("Filter"), PDFArray);
        const colorSpaceEntry =
            stream.dict.lookupMaybe(PDFName.of("ColorSpace"), PDFName) ??
            stream.dict.lookupMaybe(PDFName.of("ColorSpace"), PDFArray);
        const filterNames = this.getFilterNames(filterEntry);
        const colorSpace = this.resolveColorSpace(colorSpaceEntry, resources);
        const width = stream.dict.lookup(PDFName.of("Width"), PDFNumber).asNumber();
        const height = stream.dict.lookup(PDFName.of("Height"), PDFNumber).asNumber();
        const bitsPerComponent = stream.dict
            .lookupMaybe(PDFName.of("BitsPerComponent"), PDFNumber)
            ?.asNumber() ?? 8;

        try {
            if (filterNames.some((name) => name === "DCTDecode" || name === "JPXDecode")) {
                const imageBuffer = Buffer.from(stream.getContents());
                return sharp(imageBuffer).png().toBuffer();
            }

            if (
                (filterNames.length === 0 || filterNames.every((name) => name === "FlateDecode")) &&
                stream instanceof PDFRawStream &&
                bitsPerComponent === 8
            ) {
                const decoded = decodePDFRawStream(stream).decode();
                const channels = this.getChannelCount(colorSpace ?? "DeviceRGB");
                if (!channels) {
                    return null;
                }

                return sharp(Buffer.from(decoded), {
                    raw: {
                        width,
                        height,
                        channels,
                    },
                })
                    .toColourspace("srgb")
                    .png()
                    .toBuffer();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[PdfExtractor] Unable to convert image stream: ${message}`);
        }

        return null;
    }

    private getFilterNames(filter: PDFName | PDFArray | undefined): string[] {
        if (!filter) {
            return [];
        }

        if (filter instanceof PDFName) {
            return [this.normalizeName(filter)];
        }

        const names: string[] = [];
        for (let index = 0; index < filter.size(); index++) {
            const value = filter.lookupMaybe(index, PDFName);
            if (value) {
                names.push(this.normalizeName(value));
            }
        }
        return names;
    }

    private resolveColorSpace(value: PDFName | PDFArray | undefined, resources: PDFDict): ColorSpaceKind | null {
        if (!value) {
            return "DeviceRGB";
        }

        if (value instanceof PDFName) {
            const name = this.normalizeName(value);
            if (name === "DeviceRGB" || name === "DeviceGray" || name === "DeviceCMYK") {
                return name;
            }

            const colorSpaces = resources.lookupMaybe(PDFName.of("ColorSpace"), PDFDict);
            if (colorSpaces) {
                const referenced = colorSpaces.lookupMaybe(value, PDFArray);
                if (referenced) {
                    return this.resolveColorSpace(referenced.lookupMaybe(0, PDFName), resources);
                }
            }
            return null;
        }

        const base = value.lookupMaybe(0, PDFName);
        return base ? this.resolveColorSpace(base, resources) : null;
    }

    private getChannelCount(colorSpace: ColorSpaceKind): sharp.Channels | null {
        switch (colorSpace) {
            case "DeviceGray":
                return 1;
            case "DeviceRGB":
                return 3;
            case "DeviceCMYK":
                return 4;
            default:
                return null;
        }
    }

    private normalizeName(name: PDFName): string {
        const raw = name.asString();
        return raw.startsWith("/") ? raw.slice(1) : raw;
    }

    private getOrCreateOcrProvider(): OcrProvider {
        if (!this.ocrProvider) {
            this.ocrProvider = this.createDefaultOcrProvider();
        }
        return this.ocrProvider;
    }

    private createDefaultOcrProvider(): OcrProvider {
        if (process.env.OPENAI_API_KEY) {
            try {
                return new OpenAIVisionOcrProvider();
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.warn(
                    `[PdfExtractor] Failed to initialize OpenAI Vision OCR (${message}). Falling back to Tesseract.js.`
                );
            }
        }

        return new TesseractOcrProvider();
    }
}
