/**
 * Centralized configuration for the triage pipeline.
 * All environment variables, constants, and queue mappings live here.
 */

import dotenv from "dotenv";
import { TriageCategory } from "../types";

dotenv.config();

export const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
export const PORT = parseInt(process.env.PORT ?? "3000", 10);
export const MODEL = "llama-3.3-70b-versatile";

/** Maps each triage category to the team queue that handles it. */
export const QUEUE_MAPPINGS: Record<TriageCategory, string> = {
  "Bug Report": "Engineering",
  "Incident/Outage": "Engineering",
  "Feature Request": "Product",
  "Billing Issue": "Billing",
  "Technical Question": "IT/Security",
};

/** Fallback queue when the classifier isn't confident enough. */
export const FALLBACK_QUEUE = "General Triage";

/** Queue override when escalation triggers. */
export const ESCALATION_QUEUE = "Escalation";

/** Confidence score below this threshold triggers escalation and fallback routing. */
export const CONFIDENCE_THRESHOLD = 70;

/** Phrases in the raw message that trigger automatic escalation. */
export const ESCALATION_KEYWORDS = [
  "outage",
  "down for all users",
  "all users affected",
  "multiple users affected",
];

/** Dollar amount threshold for billing discrepancy escalation. */
export const BILLING_DISCREPANCY_THRESHOLD = 500;
