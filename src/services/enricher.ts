/**
 * Enrichment service.
 * Extracts the enrichment subset from the combined LLM response.
 * Provides a clean separation of concerns — the classifier handles the API call,
 * this module transforms the result into the enrichment shape.
 */

import { EnrichmentResult, LLMTriageResponse } from "../types";

/**
 * Extracts and normalizes enrichment data from the combined LLM triage response.
 */
export const extractEnrichment = (response: LLMTriageResponse): EnrichmentResult => ({
  coreIssue: response.coreIssue,
  identifiers: response.identifiers,
  urgencySignal: response.urgencySignal,
});
