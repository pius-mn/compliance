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
  score: number;
  summary: string;
  safetyProtocols: string[];
  environmentalImpacts: string[];
  incidentReports: string[];
  flaggedIssues: string[];
  recommendations: string;
  verifiedByAi: boolean;
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
- Rate compliance out of 100. If name mismatch or expired, score MUST be 0 and verifiedByAi MUST be false.

Tasks:
1. Summarize concisely (include name, type, expiry).
2. Extract compliance data.
3. Flag issues (mismatches/expiry heavily flagged).
4. Rate compliance (0-100).
5. Provide actionable recommendations.

Adhere to standard Kenyan EHS and Safaricom HSE protocols.`;

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
            required: ["score", "summary", "safetyProtocols", "environmentalImpacts", "incidentReports", "flaggedIssues", "recommendations", "verifiedByAi"],
            properties: {
              score: { type: Type.INTEGER },
              summary: { type: Type.STRING },
              safetyProtocols: { type: Type.ARRAY, items: { type: Type.STRING } },
              environmentalImpacts: { type: Type.ARRAY, items: { type: Type.STRING } },
              incidentReports: { type: Type.ARRAY, items: { type: Type.STRING } },
              flaggedIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendations: { type: Type.STRING },
              verifiedByAi: { type: Type.BOOLEAN }
            }
          }
        }
      });

      if (!response?.text) throw new Error("Empty response from Gemini API");
      
      const parsed = JSON.parse(response.text);
      return {
        score: Number(parsed.score) || 0,
        summary: parsed.summary || "",
        safetyProtocols: parsed.safetyProtocols || [],
        environmentalImpacts: parsed.environmentalImpacts || [],
        incidentReports: parsed.incidentReports || [],
        flaggedIssues: parsed.flaggedIssues || [],
        recommendations: parsed.recommendations || "",
        verifiedByAi: Boolean(parsed.verifiedByAi)
      };
      
    } catch (error) {
      const isRetryable = /503|UNAVAILABLE|high demand|capacity|overloaded/i.test((error as { message?: string })?.message || "");
      
      if (isRetryable && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1200));
        continue;
      }
      
      console.error(`[EHS AI Processor] Failure on attempt ${attempt}:`, error);
      
      return {
        score: 0,
        summary: "AI processing failed due to a system error.",
        safetyProtocols: [],
        environmentalImpacts: [],
        incidentReports: [],
        flaggedIssues: [`System Error: Document verification failed.`],
        recommendations: "Manual EHS review required.",
        verifiedByAi: false
      };
    }
  }
  
  throw new Error("Unreachable code reached in processEHSDocument");
}