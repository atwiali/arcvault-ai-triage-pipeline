/**
 * Lightweight logging utility with timestamps and level prefixes.
 * Keeps console output consistent across the pipeline.
 */

const timestamp = (): string => new Date().toISOString();

export const logger = {
  info: (message: string, data?: unknown): void => {
    console.log(`[${timestamp()}] INFO  ${message}`, data ?? "");
  },

  warn: (message: string, data?: unknown): void => {
    console.warn(`[${timestamp()}] WARN  ${message}`, data ?? "");
  },

  error: (message: string, data?: unknown): void => {
    console.error(`[${timestamp()}] ERROR ${message}`, data ?? "");
  },

  debug: (message: string, data?: unknown): void => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[${timestamp()}] DEBUG ${message}`, data ?? "");
    }
  },

  /** Logs a formatted triage result to the console for human readability. */
  triageResult: (result: {
    id: string;
    source: string;
    classification: { category: string; priority: string; confidenceScore: number };
    routing: { destinationQueue: string; escalationFlag: boolean; escalationReason: string | null };
    summary: string;
  }): void => {
    console.log("\n" + "=".repeat(60));
    console.log(`TRIAGE RESULT — ${result.id}`);
    console.log("=".repeat(60));
    console.log(`Source:      ${result.source}`);
    console.log(`Category:    ${result.classification.category}`);
    console.log(`Priority:    ${result.classification.priority}`);
    console.log(`Confidence:  ${result.classification.confidenceScore}%`);
    console.log(`Queue:       ${result.routing.destinationQueue}`);
    console.log(`Escalated:   ${result.routing.escalationFlag}`);
    if (result.routing.escalationReason) {
      console.log(`Reason:      ${result.routing.escalationReason}`);
    }
    console.log(`Summary:     ${result.summary}`);
    console.log("=".repeat(60) + "\n");
  },
};
