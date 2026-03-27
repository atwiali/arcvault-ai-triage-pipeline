/**
 * Escalation check service.
 * Applies deterministic rules to flag requests that need human review.
 * Three independent triggers: low confidence, keyword matches, and billing discrepancies.
 */

import { ClassificationResult, LLMTriageResponse } from "../types";
import {
  CONFIDENCE_THRESHOLD,
  ESCALATION_KEYWORDS,
  BILLING_DISCREPANCY_THRESHOLD,
} from "../config";

interface EscalationResult {
  escalationFlag: boolean;
  escalationReason: string | null;
}

/**
 * Extracts dollar amounts from raw text as a fallback when the LLM misses them.
 * Parses formats like "$1,240", "$980.00", "$ 500".
 */
const extractDollarAmounts = (text: string): number[] => {
  const pattern = /\$\s?([\d,]+(?:\.\d{1,2})?)/g;
  const amounts: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(amount)) {
      amounts.push(amount);
    }
  }

  return amounts;
};

/**
 * Checks whether a request should be escalated for human review.
 * Collects all triggered reasons and returns them as a single combined string.
 */
export const checkEscalation = (
  rawMessage: string,
  classification: ClassificationResult,
  llmResponse: LLMTriageResponse
): EscalationResult => {
  const reasons: string[] = [];
  const messageLower = rawMessage.toLowerCase();

  // Check 1: Low confidence score
  if (classification.confidenceScore < CONFIDENCE_THRESHOLD) {
    reasons.push(`Low confidence score (${classification.confidenceScore}%)`);
  }

  // Check 2: Escalation keyword matches
  for (const keyword of ESCALATION_KEYWORDS) {
    if (messageLower.includes(keyword)) {
      reasons.push(`Escalation keyword detected: "${keyword}"`);
    }
  }

  // Check 3: Billing discrepancy — combine LLM-extracted and regex-extracted amounts
  const regexAmounts = extractDollarAmounts(rawMessage);
  const allAmounts = [...new Set([...llmResponse.billingAmounts, ...regexAmounts])];
  const exceeds = allAmounts.some((amount) => amount > BILLING_DISCREPANCY_THRESHOLD);

  if (exceeds) {
    reasons.push(
      `Billing discrepancy exceeds $${BILLING_DISCREPANCY_THRESHOLD}`
    );
  }

  return {
    escalationFlag: reasons.length > 0,
    escalationReason: reasons.length > 0 ? reasons.join("; ") : null,
  };
};
