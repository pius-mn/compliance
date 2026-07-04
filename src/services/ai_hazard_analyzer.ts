/**
 * AI-powered hazard/solution note analyzer.
 *
 * Uses Gemini to rate how well a containment solution addresses an identified
 * hazard, and what critical elements were missed.
 */

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy_key",
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

export interface HazardAnalysisResult {
  score: number; // 0-100 rating of how well the solution addresses the hazard
  missedItems: string[]; // Critical elements the solution missed
}

export async function analyzeHazardSolution(
  hazard: string,
  solution: string
): Promise<HazardAnalysisResult> {
  // If either field is empty, skip analysis
  if (!hazard?.trim() || !solution?.trim()) {
    return { score: 0, missedItems: ["Cannot analyze: hazard or solution description is empty."] };
  }

  const systemInstruction = `You are a Safaricom EHS Safety Auditor AI.
Your role is to evaluate site safety reports by analyzing the relationship between identified hazards and the reported containment solutions.

For each hazard-solution pair:
1. Rate how well the described solution addresses the specific hazard (0-100).
   - A score of 100 means the solution fully and correctly mitigates the hazard.
   - A score of 0 means the solution is completely inadequate or unrelated.
2. List specific safety elements, protocols, or corrective actions that are MISSING from the solution.
   - Be precise about what was overlooked (e.g., missing PPE requirements, lack of isolation procedures, missing environmental controls, no mention of incident reporting, no supervision specified, etc.).
   - Return an empty array if the solution is comprehensive.

Use standard Kenyan EHS regulations, OSHA standards, and Safaricom HSE protocols as your benchmark.`;

  const contents = [
    `Identified Hazard: "${hazard}"`,
    `Containment Solution Reported: "${solution}"`,
    `\nEvaluate this hazard-solution pair and return your rating and gaps.`
  ];

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
            required: ["score", "missedItems"],
            properties: {
              score: {
                type: Type.INTEGER,
                description: "Rating 0-100 of how well the solution addresses the hazard"
              },
              missedItems: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of critical safety elements or actions missing from the solution"
              }
            }
          }
        }
      });

      if (!response?.text) throw new Error("Empty response from Gemini API");

      const parsed = JSON.parse(response.text);
      const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
      const missedItems = Array.isArray(parsed.missedItems)
        ? parsed.missedItems.filter((m: unknown) => typeof m === "string")
        : [];

      return { score, missedItems };

    } catch (error) {
      const isRetryable = /503|UNAVAILABLE|high demand|capacity|overloaded/i.test((error as { message?: string })?.message || "");

      if (isRetryable && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1200));
        continue;
      }

      console.error(`[Hazard Analyzer] Failure on attempt ${attempt}:`, error);

      return {
        score: 0,
        missedItems: ["AI analysis unavailable due to a system error. Manual EHS review required."]
      };
    }
  }

  throw new Error("Unreachable code reached in analyzeHazardSolution");
}
