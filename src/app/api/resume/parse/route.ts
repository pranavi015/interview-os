import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/pdf-parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    // Convert file to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("Parsing PDF file:", file.name, "of size:", file.size, "bytes");

    const text = extractTextFromPdf(buffer);

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "No readable text found in PDF" }, { status: 422 });
    }

    return NextResponse.json({ text, filename: file.name });
  } catch (error: any) {
    console.error("Resume parsing error:", error);
    return NextResponse.json({ error: error.message || "Failed to parse resume PDF" }, { status: 500 });
  }
}
