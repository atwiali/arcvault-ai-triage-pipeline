/**
 * Classification and enrichment service.
 * Makes a single LLM call to the Groq API that returns both
 * classification (category, priority, confidence) and enrichment
 * (core issue, identifiers, urgency, billing amounts, summary).
 */

import Groq from "groq-sdk";
import { GROQ_API_KEY, MODEL } from "../config";
import { LLMTriageResponse } from "../types";
import { TRIAGE_SYSTEM_PROMPT, buildTriagePrompt } from "../prompts/triage";
import { logger } from "../utils/logger";

const client = new Groq({ apiKey: GROQ_API_KEY });

/**
 * Strips markdown code fences if the LLM wraps its JSON response in them.
 * Defensive measure — the prompt asks for raw JSON, but models occasionally add fences.
 */
const stripCodeFences = (text: string): string => {
  const trimmed = text.trim();
  const fencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = trimmed.match(fencePattern);
  return match ? match[1].trim() : trimmed;
};

/** Fallback response when the LLM call or JSON parsing fails — auto-escalates via low confidence. */
const buildFallbackResponse = (message: string): LLMTriageResponse => ({
  category: "Bug Report",
  priority: "Medium",
  confidenceScore: 0,
  coreIssue: "Unable to classify — requires manual review",
  identifiers: [],
  urgencySignal: "Medium",
  billingAmounts: [],
  summary: `Automated classification failed for this request. Original message: "${message.substring(0, 100)}..."`,
});

/**
 * Validates and normalizes the parsed LLM response.
 * Ensures all fields exist and have the correct types, falling back to safe defaults.
 */
const validateResponse = (parsed: Record<string, unknown>): LLMTriageResponse => {
  const validCategories = [
    "Bug Report", "Feature Request", "Billing Issue", "Technical Question", "Incident/Outage",
  ];
  const validPriorities = ["Low", "Medium", "High"];
  const validUrgency = ["Low", "Medium", "High", "Critical"];

  return {
    category: validCategories.includes(parsed.category as string)
      ? (parsed.category as LLMTriageResponse["category"])
      : "Bug Report",
    priority: validPriorities.includes(parsed.priority as string)
      ? (parsed.priority as LLMTriageResponse["priority"])
      : "Medium",
    confidenceScore: typeof parsed.confidenceScore === "number"
      ? Math.max(0, Math.min(100, Math.round(parsed.confidenceScore)))
      : 0,
    coreIssue: typeof parsed.coreIssue === "string"
      ? parsed.coreIssue
      : "Unable to extract core issue",
    identifiers: Array.isArray(parsed.identifiers)
      ? parsed.identifiers.filter((id): id is string => typeof id === "string")
      : [],
    urgencySignal: validUrgency.includes(parsed.urgencySignal as string)
      ? (parsed.urgencySignal as LLMTriageResponse["urgencySignal"])
      : "Medium",
    billingAmounts: Array.isArray(parsed.billingAmounts)
      ? parsed.billingAmounts.filter((a): a is number => typeof a === "number")
      : [],
    summary: typeof parsed.summary === "string"
      ? parsed.summary
      : "No summary available",
  };
};

/**
 * Sends the customer message to the Groq API for combined classification and enrichment.
 * Returns a validated LLMTriageResponse, or a fallback response on any failure.
 */
export const classifyAndEnrich = async (
  message: string,
  source: string
): Promise<LLMTriageResponse> => {
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: TRIAGE_SYSTEM_PROMPT },
        { role: "user", content: buildTriagePrompt(message, source) },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      logger.error("LLM response contained no text");
      return buildFallbackResponse(message);
    }

    const rawJson = stripCodeFences(text);
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    return validateResponse(parsed);
  } catch (error) {
    logger.error("Classification failed", error);
    return buildFallbackResponse(message);
  }
};
