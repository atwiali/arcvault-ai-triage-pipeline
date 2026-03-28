# CLAUDE.md — Project Instructions for Claude Code

## Project Overview

ArcVault AI Triage Pipeline — an AI-powered intake and triage system that classifies, enriches, routes, and escalates unstructured customer support requests using LLM-driven workflows. Built with TypeScript, Express, and Groq SDK (Llama 3.3 70B).

## Tech Stack

- **Runtime**: Node.js 18+, TypeScript 5.7+
- **Framework**: Express.js 4.x
- **LLM**: Groq SDK → Llama 3.3 70B Versatile (temperature 0.1)
- **Security**: Helmet, CORS, express-rate-limit, API key auth, input sanitization
- **Testing**: Vitest, Supertest
- **Build**: `tsc` compiles to `dist/`, `tsx` for dev

## Commands

```bash
npm run dev          # Start dev server with hot reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled JS from dist/
npm test             # Run all tests (vitest)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Architecture

**Pipeline flow**: `POST request → classifyAndEnrich() → extractEnrichment() → routeRequest() → checkEscalation() → writeTriageOutput() → JSON response`

- **Single LLM call** for classification + enrichment (reduces latency by ~50%)
- **Routing & escalation are deterministic** — no LLM involvement, purely rule-based
- **Fallback on LLM failure**: Returns confidenceScore=0 which auto-escalates to human review

### Key Directories

- `src/middleware/` — Security layers (auth, rate limiting, sanitization, helmet/CORS)
- `src/services/` — Core pipeline logic (classifier, enricher, router, escalation, output)
- `src/prompts/` — LLM prompt templates
- `src/config/` — Environment vars, constants, queue mappings
- `src/types/` — All TypeScript interfaces
- `tests/unit/` — Unit tests for services and middleware
- `tests/integration/` — API endpoint tests
- `tests/__mocks__/` — Shared Groq SDK mock

### Endpoints

- `POST /webhook/ingest` — Process a single customer request
- `POST /process-all` — Process all 5 sample requests (demo)

## Coding Conventions

- All services export pure functions (except classifier which wraps the Groq API)
- Config constants are centralized in `src/config/index.ts`
- Types are centralized in `src/types/index.ts`
- Use the `logger` utility from `src/utils/logger.ts` for all console output
- Tests mock the Groq SDK via `tests/__mocks__/groqMock.ts` — always use the shared mock
- Tests also mock `src/services/output` to avoid file writes during testing

## Environment Variables

- `GROQ_API_KEY` — Required. Groq API key for LLM calls
- `PORT` — Optional. Server port (default: 3000)
- `API_KEY` — Optional. Set to enable API key auth via `x-api-key` header
- `ALLOWED_ORIGINS` — Optional. Comma-separated CORS origins (default: `*`)
- `NODE_ENV` — Set to `test` during testing to skip server startup

## Important Thresholds

- Confidence threshold: 70% (below this → fallback routing + escalation)
- Billing discrepancy: $500 (above this → escalation)
- Rate limit (general): 100 req / 15 min per IP
- Rate limit (ingest): 30 req / 1 min per IP
- Max message length: 10,000 characters
- Max request body: 100KB
