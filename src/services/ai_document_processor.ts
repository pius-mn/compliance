/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy_key",
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

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
      const response = await ai.models.generateContent({
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
      });

      if (!response?.text) throw new Error("Empty response from Gemini API");
      
      const parsed = JSON.parse(response.text);
      
      // Validate expiryDate — must be YYYY-MM-DD or null
      let expiryDate: string | null = parsed.expiryDate || null;
      if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
        expiryDate = null;
      }
      
      return {
        verifiedByAi: Boolean(parsed.verifiedByAi),
        expiryDate,
        failureReason: parsed.failureReason || null
      };
      
    } catch (error) {
      const isRetryable = /503|UNAVAILABLE|high demand|capacity|overloaded/i.test((error as { message?: string })?.message || "");
      
      if (isRetryable && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1200));
        continue;
      }
      
      console.error(`[EHS AI Processor] Failure on attempt ${attempt}:`, error);
      
      return {
        verifiedByAi: false,
        expiryDate: null,
        failureReason: "AI processor encountered an error during analysis."
      };
    }
  }
  
  throw new Error("Unreachable code reached in processEHSDocument");
}