/**
 * Core type definitions for the ArcVault AI Triage Pipeline.
 * All data shapes flowing through the pipeline are defined here.
 */

export type TriageCategory =
  | "Bug Report"
  | "Feature Request"
  | "Billing Issue"
  | "Technical Question"
  | "Incident/Outage";

export type Priority = "Low" | "Medium" | "High";

export type UrgencySignal = "Low" | "Medium" | "High" | "Critical";

export interface IngestRequest {
  source: string;
  message: string;
}

export interface ClassificationResult {
  category: TriageCategory;
  priority: Priority;
  confidenceScore: number;
}

export interface EnrichmentResult {
  coreIssue: string;
  identifiers: string[];
  urgencySignal: UrgencySignal;
}

export interface RoutingResult {
  destinationQueue: string;
  escalationFlag: boolean;
  escalationReason: string | null;
}

/** The raw JSON shape returned by the LLM — combines classification, enrichment, and summary. */
export interface LLMTriageResponse {
  category: TriageCategory;
  priority: Priority;
  confidenceScore: number;
  coreIssue: string;
  identifiers: string[];
  urgencySignal: UrgencySignal;
  billingAmounts: number[];
  summary: string;
}

/** The final structured output for each triaged request. */
export interface TriageOutput {
  id: string;
  timestamp: string;
  source: string;
  rawMessage: string;
  classification: ClassificationResult;
  enrichment: EnrichmentResult;
  routing: RoutingResult;
  summary: string;
}
