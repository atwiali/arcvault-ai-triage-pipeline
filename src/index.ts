/**
 * Entry point — Express server with webhook endpoint for the ArcVault AI Triage Pipeline.
 * Orchestrates the full pipeline: ingest → classify → enrich → route → escalate → output.
 */

import express, { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { PORT, ESCALATION_QUEUE } from "./config";
import { IngestRequest, TriageOutput, ClassificationResult } from "./types";
import { classifyAndEnrich } from "./services/classifier";
import { extractEnrichment } from "./services/enricher";
import { routeRequest } from "./services/router";
import { checkEscalation } from "./services/escalation";
import { writeTriageOutput, appendTriageOutput } from "./services/output";
import { detectInjection, sanitizePrompt } from "./services/promptGuard";
import { sampleRequests } from "./data/sampleRequests";
import { logger } from "./utils/logger";
import { securityHeaders, corsMiddleware } from "./middleware/security";
import { generalLimiter, ingestLimiter } from "./middleware/rateLimiter";
import { authenticate } from "./middleware/auth";
import { sanitizeInput } from "./middleware/sanitize";

const app = express();

// --- Security layers ---
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: "100kb" }));
app.use(generalLimiter);
app.use(authenticate);
app.use(sanitizeInput);

/**
 * Runs a single request through the full triage pipeline.
 * Shared between the /webhook/ingest and /process-all endpoints.
 */
const processRequest = async (request: IngestRequest): Promise<TriageOutput> => {
  const { source, message } = request;

  // Step 0: Prompt injection detection
  const guard = detectInjection(message);
  if (!guard.safe) {
    logger.warn(`Blocked prompt injection attempt (score: ${guard.threatScore}) from ${source}`);
    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      source,
      rawMessage: message,
      classification: { category: "Bug Report", priority: "Medium", confidenceScore: 0 },
      enrichment: {
        coreIssue: "Message flagged by prompt injection detection — requires manual review",
        identifiers: [],
        urgencySignal: "Medium",
      },
      routing: {
        destinationQueue: ESCALATION_QUEUE,
        escalationFlag: true,
        escalationReason: `Prompt injection detected (score: ${guard.threatScore}): ${guard.detections.join("; ")}`,
      },
      summary: "This message was flagged as a potential prompt injection attempt and has been escalated for manual review.",
    };
  }

  // Step 0.5: Sanitize surviving injection fragments before LLM call
  const sanitizedMessage = sanitizePrompt(message);

  // Step 1: Classification + Enrichment (single LLM call)
  const llmResponse = await classifyAndEnrich(sanitizedMessage, source);

  const classification: ClassificationResult = {
    category: llmResponse.category,
    priority: llmResponse.priority,
    confidenceScore: llmResponse.confidenceScore,
  };

  // Step 2: Extract enrichment subset
  const enrichment = extractEnrichment(llmResponse);

  // Step 3: Deterministic routing
  let destinationQueue = routeRequest(classification);

  // Step 4: Escalation check
  const escalation = checkEscalation(message, classification, llmResponse);

  // Override queue if escalated
  if (escalation.escalationFlag) {
    destinationQueue = ESCALATION_QUEUE;
  }

  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    source,
    rawMessage: message,
    classification,
    enrichment,
    routing: {
      destinationQueue,
      escalationFlag: escalation.escalationFlag,
      escalationReason: escalation.escalationReason,
    },
    summary: llmResponse.summary,
  };
};

/**
 * POST /webhook/ingest
 * Accepts a single customer request, runs it through the pipeline,
 * appends the result to the output file, and returns the structured result.
 */
app.post("/webhook/ingest", ingestLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { source, message } = req.body as Partial<IngestRequest>;

    if (!source || typeof source !== "string" || !message || typeof message !== "string") {
      res.status(400).json({
        error: "Request body must include 'source' (string) and 'message' (string)",
      });
      return;
    }

    logger.info(`Processing ingest request from ${source}`);
    const result = await processRequest({ source, message });
    await appendTriageOutput(result);
    logger.triageResult(result);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /process-all
 * Runs all 5 sample requests through the pipeline sequentially,
 * writes the combined results to the output file, and returns the array.
 * Sequential processing avoids API rate limits.
 */
app.post("/process-all", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Processing all ${sampleRequests.length} sample requests`);
    const results: TriageOutput[] = [];

    for (const request of sampleRequests) {
      logger.info(`Processing: "${request.message.substring(0, 60)}..."`);
      const result = await processRequest(request);
      logger.triageResult(result);
      results.push(result);
    }

    await writeTriageOutput(results);
    logger.info(`Pipeline complete — ${results.length} requests processed`);

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
});

/** Global error handler — catches unhandled errors from route handlers. */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", err.message);
  res.status(500).json({ error: "Internal server error" });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    logger.info(`ArcVault Triage Pipeline running on http://localhost:${PORT}`);
    logger.info("Endpoints:");
    logger.info("  POST /webhook/ingest   — Process a single request");
    logger.info("  POST /process-all      — Process all sample requests");
  });
}

export { app };
