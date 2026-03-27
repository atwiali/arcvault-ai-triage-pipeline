# ArcVault AI Triage Pipeline

AI-powered intake and triage pipeline that automatically classifies, enriches, routes, and escalates unstructured customer requests using LLM-driven workflows.

## Architecture

```
                         ┌─────────────────────┐
                         │   Customer Request   │
                         │  (Email / Web Form / │
                         │   Support Portal)    │
                         └─────────┬───────────┘
                                   │
                                   ▼
                         ┌─────────────────────┐
                         │  POST /webhook/ingest│
                         │   (Express Server)   │
                         └─────────┬───────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Step 1: Classification +    │
                    │  Enrichment (Groq API)       │
                    │  Single LLM call returns:    │
                    │  - category, priority, score │
                    │  - coreIssue, identifiers    │
                    │  - urgencySignal, summary    │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Step 2: Deterministic       │
                    │  Routing (category → queue)  │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Step 3: Escalation Check    │
                    │  - Low confidence (<70%)     │
                    │  - Keyword triggers          │
                    │  - Billing discrepancy >$500 │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Step 4: Structured Output   │
                    │  → output/triage-results.json│
                    │  → Console log               │
                    └─────────────────────────────┘
```

## Prerequisites

- **Node.js** v18 or higher
- **Groq API key** — get one for free at [console.groq.com](https://console.groq.com) (no credit card required)

## Setup

```bash
# Clone the repository
git clone https://github.com/your-username/arcvault-ai-triage-pipeline.git
cd arcvault-ai-triage-pipeline

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Start the development server
npm run dev
```

## API Endpoints

### `POST /webhook/ingest`

Process a single customer request through the triage pipeline.

**Request body:**
```json
{
  "source": "Email",
  "message": "Hi, I keep getting a 403 error when logging in."
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/webhook/ingest \
  -H "Content-Type: application/json" \
  -d '{"source": "Email", "message": "Hi, I keep getting a 403 error when logging in."}'
```

### `POST /process-all`

Run all 5 hardcoded sample requests through the pipeline for demo purposes.

**Example:**
```bash
curl -X POST http://localhost:3000/process-all
```

## Sample Output

Each processed request produces a structured JSON record:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2025-01-15T14:30:00.000Z",
  "source": "Email",
  "rawMessage": "Hi, I tried logging in this morning and keep getting a 403 error...",
  "classification": {
    "category": "Bug Report",
    "priority": "Medium",
    "confidenceScore": 92
  },
  "enrichment": {
    "coreIssue": "User unable to log in due to persistent 403 Forbidden error following a recent platform update.",
    "identifiers": ["arcvault.io/user/jsmith", "403"],
    "urgencySignal": "Medium"
  },
  "routing": {
    "destinationQueue": "Engineering",
    "escalationFlag": false,
    "escalationReason": null
  },
  "summary": "A user is experiencing a 403 error when attempting to log in, which started after last Tuesday's update. The affected account is arcvault.io/user/jsmith. This should be investigated by the Engineering team as a potential regression from the recent release."
}
```

## Project Structure

```
arcvault-ai-triage-pipeline/
├── src/
│   ├── index.ts                  # Express server — orchestrates the pipeline
│   ├── config/
│   │   └── index.ts              # Environment variables, constants, queue mappings
│   ├── data/
│   │   └── sampleRequests.ts     # 5 synthetic test messages
│   ├── services/
│   │   ├── classifier.ts         # LLM classification + enrichment (single API call)
│   │   ├── enricher.ts           # Extracts enrichment subset from LLM response
│   │   ├── router.ts             # Deterministic routing (category → queue)
│   │   ├── escalation.ts         # Escalation flag logic (confidence, keywords, billing)
│   │   └── output.ts             # Writes structured JSON output to file
│   ├── prompts/
│   │   └── triage.ts             # LLM prompt templates with documented rationale
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces for all data shapes
│   └── utils/
│       └── logger.ts             # Logging utility with formatted triage output
├── output/                       # Generated triage result JSON files
├── docs/
│   ├── architecture.md           # System design, routing, escalation, scaling
│   └── prompts.md                # Prompt documentation with design rationale
├── .env.example                  # Environment variable template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Tech Stack

| Technology | Purpose | Reasoning |
|-----------|---------|-----------|
| **TypeScript** | Language | Type safety catches data shape errors at compile time — critical when working with LLM JSON output |
| **Express.js** | HTTP server | Minimal, battle-tested, perfect for a webhook-driven pipeline |
| **Groq SDK** | LLM integration | Fast inference API with a generous free tier — no credit card required |
| **llama-3.3-70b-versatile** | LLM model | Strong structured output capability, good balance of speed and accuracy for classification tasks, free on Groq |
| **uuid** | ID generation | Standard RFC 4122 UUIDs for unique triage record identification |
| **dotenv** | Configuration | Keeps secrets out of code, standard .env pattern |
| **tsx** | Dev runner | Fast TypeScript execution without a build step during development |

## What I'd Improve in Phase 2

- **Feedback loop**: Let agents mark classifications as correct/incorrect, use that data to refine prompts and measure accuracy over time.
- **Multi-model classification**: Run a cheaper/faster model first, escalate ambiguous results to a more capable model — reduces cost while maintaining quality.
- **Dashboard**: Real-time web UI showing triage queue depths, escalation rates, classification distribution, and processing latency.
- **Slack/Teams integration**: Push escalated tickets directly to the on-call channel with a one-click acknowledge action.
- **Retry with backoff**: Add exponential retry logic for transient API failures instead of immediately falling back.
- **Persistent storage**: Replace file-based output with a database (PostgreSQL) for querying, analytics, and audit trails.
- **Rate limiting**: Add request throttling on the ingest endpoint to prevent abuse and manage API costs.
- **Batch processing**: Support ingesting multiple messages in a single request for high-volume scenarios.
- **Confidence calibration**: Track actual vs. predicted confidence scores to recalibrate the threshold over time.
