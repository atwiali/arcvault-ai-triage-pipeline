# Architecture

## Model Choice

**Model**: Llama 3.3 70B Versatile via Groq API (free tier)

**Why Groq + Llama 3.3 70B**: The assessment requires free or open-source tooling. Groq provides a generous free tier (30 requests/minute, no credit card required) with extremely fast inference (~200-500ms per call). Llama 3.3 70B was chosen over smaller models because it produces consistently accurate structured JSON output for classification tasks — smaller models (8B) tend to hallucinate field names or produce malformed JSON. The 70B model hits the right balance of accuracy, speed, and zero cost for this use case.

**Alternatives considered**: Ollama (fully local, but requires model download and varies by machine specs), OpenAI (free tier is limited), Gemini (free tier has region restrictions). Groq was the most reliable free option with production-grade latency.

## System Design

The ArcVault AI Triage Pipeline is a single-process Node.js application that exposes two HTTP endpoints and orchestrates a linear processing pipeline for each incoming customer request.

### How Pieces Connect

```
Express Server (index.ts)
    │
    ├─ Receives POST request with { source, message }
    │
    ├─ classifier.ts ──► Groq API (single call)
    │                     Returns: category, priority, confidence,
    │                     coreIssue, identifiers, urgencySignal,
    │                     billingAmounts, summary
    │
    ├─ enricher.ts ────► Extracts enrichment subset from LLM response
    │                     (pure transformation, no API call)
    │
    ├─ router.ts ──────► Maps category to team queue (deterministic)
    │
    ├─ escalation.ts ──► Checks escalation rules (deterministic)
    │                     May override routing queue
    │
    └─ output.ts ──────► Writes JSON to output/triage-results.json
```

### What Triggers What

1. An HTTP POST to `/webhook/ingest` or `/process-all` triggers the pipeline.
2. The Express route handler calls `processRequest()` which orchestrates all steps sequentially.
3. The classifier makes an Groq API call — this is the only external dependency in the pipeline.
4. Routing and escalation are purely deterministic — no network calls, no side effects.
5. The output service writes results to disk.

### Single LLM Call Design

Classification and enrichment are combined into a single API call. The prompt asks for a JSON object containing all fields (category, priority, confidence, core issue, identifiers, urgency, billing amounts, summary). This reduces latency by ~50% and ensures the classification and enrichment are consistent with each other.

The `classifier.ts` service owns the API call. The `enricher.ts` service exists as a clean abstraction boundary — it extracts and validates the enrichment subset without making its own call. This keeps service responsibilities clear while avoiding redundant API usage.

## Routing Logic

Routing is deterministic and rule-based — no LLM involvement. This ensures routing decisions are predictable, auditable, and fast.

### Category-to-Queue Mapping

| Category | Destination Queue | Rationale |
|----------|------------------|-----------|
| Bug Report | Engineering | Bugs need developer investigation and code fixes |
| Incident/Outage | Engineering | Active incidents require immediate engineering response |
| Feature Request | Product | Product team owns the roadmap and feature prioritization |
| Billing Issue | Billing | Billing team has access to invoicing systems and contract details |
| Technical Question | IT/Security | How-to questions and auth/SSO topics route to IT |

### Fallback Routing

When the classifier's confidence score is below 70%, the request routes to **General Triage** regardless of the predicted category. This prevents misrouted tickets when the model is uncertain — a human triager in the General Triage queue will review and reroute.

## Escalation Logic

Escalation is a separate, deterministic check that runs after routing. If any escalation rule triggers, the destination queue is overridden to **Escalation** and the `escalationFlag` is set to `true`.

### Escalation Criteria

| Rule | Trigger Condition | Rationale |
|------|-------------------|-----------|
| Low confidence | `confidenceScore < 70` | The model isn't sure — a human should verify the classification |
| Keyword match | Message contains: "outage", "down for all users", "all users affected", "multiple users affected" | These phrases signal high-impact incidents that need immediate human attention |
| Billing discrepancy | Any dollar amount in the message exceeds $500 | Large billing discrepancies carry financial and legal risk |

### Why Deterministic, Not LLM?

Escalation rules are safety-critical. Using deterministic rules means:
- **Predictable**: The same input always produces the same escalation decision.
- **Auditable**: You can trace exactly which rule triggered and why.
- **Fast**: No API call needed, sub-millisecond execution.
- **Reliable**: No risk of the LLM hallucinating an escalation decision or missing a critical keyword.

## Production Scaling Considerations

### Reliability

- **Graceful LLM failure**: If the Groq API call fails, the pipeline returns a fallback response with `confidenceScore: 0`, which auto-escalates to human review. No request is silently dropped.
- **Input validation**: The Express endpoint validates request bodies before processing, returning 400 for malformed input.
- **File write isolation**: Output file write failures are caught and logged but don't crash the server or affect the HTTP response.

### Cost

- **Single LLM call**: Combining classification and enrichment halves the API cost per request compared to separate calls.
- **Token efficiency**: The prompt is structured to produce concise JSON output, minimizing output tokens.
- **Model selection**: Llama 3.3 70B on Groq is chosen for its free tier availability while maintaining strong classification accuracy.

### Latency

- **Sequential processing**: The `/process-all` endpoint processes requests sequentially to avoid rate limits. In production, a job queue (Bull, BullMQ) would enable parallel processing with controlled concurrency.
- **No unnecessary I/O**: The router and escalation services are pure functions with no I/O, adding negligible latency.

### Rate Limiting

- **API-side**: The Groq API has rate limits. The sequential processing in `/process-all` naturally stays under limits for small batches.
- **Server-side**: In production, add Express rate limiting (express-rate-limit) on the ingest endpoint to prevent abuse.

### Retry Logic

- **Current**: Single attempt with fallback on failure.
- **Production**: Add exponential backoff retry (3 attempts, 1s/2s/4s delays) for transient API errors (429, 500, 503). Use a circuit breaker pattern if the API is consistently failing.

## Phase 2 Additions

### Feedback Loops
Allow support agents to correct classifications after review. Track accuracy metrics (precision, recall per category) and use corrections to refine prompts or fine-tune a custom classifier.

### Multi-Model Classification
Route simple/clear requests through a smaller model (Llama 3.1 8B) and only escalate ambiguous cases to a larger model (Llama 3.3 70B). This could reduce latency and cost while maintaining quality on edge cases.

### Real-Time Dashboard
Build a web UI showing:
- Queue depths by team
- Escalation rate over time
- Classification distribution (pie chart by category)
- Average confidence scores
- Processing latency percentiles

### Slack Integration
Push escalated tickets to a dedicated Slack channel with:
- Formatted message showing classification, urgency, and summary
- Action buttons: "Acknowledge", "Reroute", "Mark as False Positive"
- Thread updates when the ticket is resolved

### Persistent Storage
Replace file-based output with PostgreSQL for:
- Full-text search across triage history
- Analytics queries (e.g., "show me all billing escalations this week")
- Audit trail with immutable records
- Multi-instance support (current file-based approach doesn't support concurrent writers)
