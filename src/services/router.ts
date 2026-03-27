/**
 * Deterministic routing service.
 * Maps classification categories to team queues. No LLM calls —
 * purely rule-based so routing decisions are predictable and auditable.
 */

import { ClassificationResult } from "../types";
import { QUEUE_MAPPINGS, FALLBACK_QUEUE, CONFIDENCE_THRESHOLD } from "../config";

/**
 * Routes a classified request to the appropriate team queue.
 * Falls back to "General Triage" when the classifier's confidence is too low.
 */
export const routeRequest = (classification: ClassificationResult): string => {
  if (classification.confidenceScore < CONFIDENCE_THRESHOLD) {
    return FALLBACK_QUEUE;
  }

  return QUEUE_MAPPINGS[classification.category] ?? FALLBACK_QUEUE;
};
