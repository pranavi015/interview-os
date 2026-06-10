import zlib from "zlib";

/**
 * Dependency-free utility to extract plain text from standard PDF Buffers.
 * It identifies FlateDecode compressed streams, decompresses them using Node zlib,
 * and extracts text strings inside Tj/TJ operators.
 */
export function extractTextFromPdf(pdfBuffer: Buffer): string {
  try {
    const pdfString = pdfBuffer.toString("binary");
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match;
    let extractedText = "";

    // Helper to find the object metadata for a given stream index
    const findFilter = (startIndex: number): boolean => {
      const precedingContent = pdfString.slice(Math.max(0, startIndex - 500), startIndex);
      return precedingContent.includes("/FlateDecode");
    };

    while ((match = streamRegex.exec(pdfString)) !== null) {
      const streamContent = match[1];
      const isCompressed = findFilter(match.index);

      let decompressed: Buffer;

      if (isCompressed) {
        try {
          // Convert binary string stream back to Buffer for decompression
          const compressedBuffer = Buffer.from(streamContent, "binary");
          decompressed = zlib.inflateSync(compressedBuffer);
        } catch {
          try {
            const compressedBuffer = Buffer.from(streamContent, "binary");
            decompressed = zlib.unzipSync(compressedBuffer);
          } catch {
            continue; // Skip streams that fail to decompress
          }
        }
      } else {
        decompressed = Buffer.from(streamContent, "binary");
      }

      const decompressedString = decompressed.toString("utf-8");
      
      // Extract text content from Tj / TJ operators
      // Pattern 1: (Text) Tj
      // Pattern 2: [(Text1) 10 (Text2)] TJ
      const tjMatches = decompressedString.match(/\((.*?)\)\s*Tj/g) || [];
      const TJMatches = decompressedString.match(/\[([\s\S]*?)\]\s*TJ/g) || [];

      for (const tj of tjMatches) {
        const text = tj.slice(1, tj.lastIndexOf(")"));
        extractedText += cleanPdfText(text) + " ";
      }

      for (const TJ of TJMatches) {
        const inner = TJ.slice(1, TJ.lastIndexOf("]"));
        // Extract all substrings in parentheses e.g. (Hello) -10 (World)
        const subStrings = inner.match(/\((.*?)\)/g) || [];
        for (const sub of subStrings) {
          const text = sub.slice(1, -1);
          extractedText += cleanPdfText(text) + " ";
        }
      }
    }

    // Fallback if regex parsing yields very little text (try basic clean match of binary)
    if (extractedText.trim().length < 50) {
      const cleanBinary = pdfString
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\xff]/g, " ")
        .replace(/\s+/g, " ");
      const words = cleanBinary.match(/[a-zA-Z]{3,15}/g) || [];
      return words.slice(0, 1000).join(" ");
    }

    return extractedText.replace(/\s+/g, " ").trim();
  } catch (error) {
    console.error("Error parsing PDF binary:", error);
    return "Error parsing PDF contents.";
  }
}

function cleanPdfText(text: string): string {
  return text
    .replace(/\\([\d]{3})/g, (match, octal) => String.fromCharCode(parseInt(octal, 8))) // Convert octal characters
    .replace(/\\(.)/g, "$1"); // Escape sequences like \( or \)
}
