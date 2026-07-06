/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { withTimeout, TtlCache, isRetryableError, getRetryDelay } from "../utils/aiUtils";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy_key",
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

// ─── In-memory TTL cache ────────────────────────────────────────────────────
// Avoids redundant Gemini calls when the same document is re-verified within
// the TTL window (e.g. on retry or re-render).

const cache = new TtlCache<EHSAnalysisResult>(5 * 60); // 5 minutes

function getCacheKey(
  documentText: string,
  documentType: string,
  fileBase64: string | undefined,
  technicianName: string | undefined,
): string {
  return `${fileBase64 ? "FILE" : documentText.slice(0, 200)}::${documentType}::${technicianName || ""}`;
}

export interface EHSAnalysisResult {
  verifiedByAi: boolean;
  /** Extracted expiry date in YYYY-MM-DD format, or null if not found / not applicable */
  expiryDate: string | null;
  /** Human-readable reason explaining why verification failed, or null if passed */
  failureReason: string | null;
}

export async function processEHSDocument(
  documentText: string,
  documentType: string,
  fileBase64?: string,
  fileMimeType?: string,
  technicianName?: string
): Promise<EHSAnalysisResult> {
  // ── Check cache first ──────────────────────────────────────────────────
  const cacheKey = getCacheKey(documentText, documentType, fileBase64, technicianName);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // ── Skip analysis for empty / trivial content ──────────────────────────
  if (!documentText?.trim() && !fileBase64) {
    const skip: EHSAnalysisResult = {
      verifiedByAi: false,
      expiryDate: null,
      failureReason: "No document content or file provided for AI analysis.",
    };
    return skip;
  }

  const systemInstruction = `You are the Safaricom Safety and Compliance Auditor AI.
Evaluate the provided Environmental Health & Safety (EHS) document.

CRITICAL INSTRUCTIONS:
- Verify technician name: "${technicianName || 'Not Provided'}". Mismatch = CRITICAL FAILURE.
- Verify document type: "${documentType}".
- Check Expiry Date. Expired = CRITICAL FAILURE.
- Rate compliance out of 100. If name mismatch or expired, verifiedByAi MUST be false.
- Extract the expiry date from the document and return it in YYYY-MM-DD format. If no expiry date is found, return null.

Adhere to standard Kenyan EHS and Safaricom HSE protocols.

Return verifiedByAi (boolean), expiryDate (string or null), and failureReason (string — explain why verification failed, or null if passed).`;

  const contents: (string | { text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
  
  if (fileBase64 && fileMimeType?.match(/^(application\/pdf|image\/)/)) {
    contents.push(
      { inlineData: { mimeType: fileMimeType, data: fileBase64.replace(/^data:.*;base64,/, "") } },
      `Document Category Type: ${documentType}\n\nPlease perform EHS audit analysis on this attached document.`
    );
  } else {
    contents.push(`Document Category Type: ${documentType}\n\nDocument Raw Content:\n${documentText}`);
  }

  const maxAttempts = 3;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              required: ["verifiedByAi"],
              properties: {
                verifiedByAi: { type: Type.BOOLEAN },
                expiryDate: { type: Type.STRING },
                failureReason: { type: Type.STRING }
              }
            }
          }
        }),
        20_000 // 20s timeout per attempt
      );

      if (!(response as { text?: string })?.text) throw new Error("Empty response from Gemini API");
      
      const parsed = JSON.parse((response as { text: string }).text);
      
      // Validate expiryDate — must be YYYY-MM-DD or null
      let expiryDate: string | null = parsed.expiryDate || null;
      if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
        expiryDate = null;
      }
      
      const result: EHSAnalysisResult = {
        verifiedByAi: Boolean(parsed.verifiedByAi),
        expiryDate,
        failureReason: parsed.failureReason || null
      };

      // Cache the successful result
      cache.set(cacheKey, result);
      return result;
      
    } catch (error) {
      const { retryable, isTimeout } = isRetryableError(error);
      
      if (retryable && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, getRetryDelay(attempt)));
        continue;
      }
      
      console.error(`[EHS AI Processor] Failure on attempt ${attempt}:`, error);
      
      return {
        verifiedByAi: false,
        expiryDate: null,
        failureReason: isTimeout
          ? "AI analysis timed out. Please try again."
          : "AI processor encountered an error during analysis."
      };
    }
  }
  
  throw new Error("Unreachable code reached in processEHSDocument");
}