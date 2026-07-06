/**
 * AI-powered hazard/solution note analyzer.
 *
 * Uses Gemini to rate how well a containment solution addresses an identified
 * hazard, and what critical elements were missed.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { withTimeout, TtlCache, isRetryableError, getRetryDelay } from "../utils/aiUtils";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy_key",
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

// ─── In-memory TTL cache ────────────────────────────────────────────────────
// Avoids redundant Gemini calls when the same hazard+solution pair is
// re-analyzed (e.g. on re-render or page navigation).

const cache = new TtlCache<HazardAnalysisResult>(5 * 60); // 5 minutes

function getCacheKey(hazard: string, solution: string): string {
  return `${hazard.slice(0, 200)}::${solution.slice(0, 200)}`;
}

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

  // ── Check cache first ──────────────────────────────────────────────────
  const cacheKey = getCacheKey(hazard, solution);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

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
      const response = await withTimeout(
        ai.models.generateContent({
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
        }),
        15_000 // 15s timeout per attempt
      );

      if (!(response as { text?: string })?.text) throw new Error("Empty response from Gemini API");

      const parsed = JSON.parse((response as { text: string }).text);
      const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
      const missedItems = Array.isArray(parsed.missedItems)
        ? parsed.missedItems.filter((m: unknown) => typeof m === "string")
        : [];

      const result: HazardAnalysisResult = { score, missedItems };

      // Cache the successful result
      cache.set(cacheKey, result);
      return result;

    } catch (error) {
      const { retryable, isTimeout } = isRetryableError(error);

      if (retryable && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, getRetryDelay(attempt)));
        continue;
      }

      console.error(`[Hazard Analyzer] Failure on attempt ${attempt}:`, error);

      return {
        score: 0,
        missedItems: isTimeout
          ? ["AI analysis timed out. Manual EHS review required."]
          : ["AI analysis unavailable due to a system error. Manual EHS review required."]
      };
    }
  }

  throw new Error("Unreachable code reached in analyzeHazardSolution");
}
