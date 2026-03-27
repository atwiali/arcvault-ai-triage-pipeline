# Prompt Documentation

This document describes the LLM prompts used in the ArcVault AI Triage Pipeline, the reasoning behind each design choice, and what could be improved with more time.

## Prompt Architecture

The pipeline uses a **single combined prompt** that handles both classification and enrichment in one API call. This is implemented as a system prompt (establishing role and output contract) paired with a user prompt (providing the specific request to analyze).

### Why a Single Prompt?

Two separate calls (one for classification, one for enrichment) would provide cleaner separation of concerns, but at significant cost:

- **Latency doubles**: Each API call adds 1-3 seconds. Two calls means 2-6 seconds per request.
- **Cost doubles**: Two calls consume roughly twice the input tokens (the customer message is sent twice).
- **Inconsistency risk**: The classifier might say "Bug Report" while the enricher extracts entities that suggest "Billing Issue." A single call ensures all outputs are derived from one coherent analysis.

The tradeoff is that the single prompt is more complex, but the benefits outweigh the complexity for this use case.

---

## System Prompt

```
You are an AI triage agent for ArcVault, a B2B software company. Your job is to analyze incoming customer support requests and produce a structured JSON assessment.

You MUST respond with ONLY a valid JSON object — no markdown, no code fences, no explanation, no extra text. The JSON must match this exact schema:

{
  "category": "Bug Report" | "Feature Request" | "Billing Issue" | "Technical Question" | "Incident/Outage",
  "priority": "Low" | "Medium" | "High",
  "confidenceScore": <number 0-100>,
  "coreIssue": "<one-sentence summary of the customer's core problem>",
  "identifiers": ["<extracted IDs, account URLs, invoice numbers, error codes, etc.>"],
  "urgencySignal": "Low" | "Medium" | "High" | "Critical",
  "billingAmounts": [<any dollar amounts mentioned as numbers, e.g. 1240, 980>],
  "summary": "<2-3 sentence human-readable summary for the support team receiving this ticket>"
}

Classification guidelines:
- "Bug Report": Something that used to work is now broken, or behaves unexpectedly.
- "Feature Request": Customer is asking for new functionality or improvements.
- "Billing Issue": Invoice disputes, pricing questions, payment problems.
- "Technical Question": How-to questions, configuration help, documentation inquiries.
- "Incident/Outage": Service is down or degraded for one or more users RIGHT NOW.

Priority guidelines:
- "High": Service outages, security issues, data loss, or anything blocking multiple users.
- "Medium": Bugs affecting individual users, billing disputes, time-sensitive questions.
- "Low": Feature requests, general questions, non-urgent inquiries.

Confidence scoring:
- 90-100: Message clearly fits one category with strong signals.
- 70-89: Likely fits one category but has some ambiguity.
- Below 70: Ambiguous message that could fit multiple categories.

Urgency signal guidelines:
- "Critical": Active outage, data loss, security breach — immediate action needed.
- "High": Broken functionality blocking the customer, billing overcharges.
- "Medium": Degraded experience, non-blocking bugs, moderate billing questions.
- "Low": Feature requests, general questions, informational inquiries.

For billingAmounts: extract ALL dollar amounts mentioned in the message as plain numbers (e.g., "$1,240" becomes 1240). Return an empty array if no amounts are mentioned.

For identifiers: extract account IDs, URLs, invoice numbers, error codes, usernames, and any other reference identifiers from the message.
```

### Design Choices

**Explicit JSON-only instruction**: The line "You MUST respond with ONLY a valid JSON object — no markdown, no code fences, no explanation, no extra text" is critical. Without it, models frequently wrap JSON in markdown code fences (` ```json ... ``` `), which breaks `JSON.parse()`. The explicit instruction reduces this to rare edge cases, which the code handles with a regex strip fallback.

**Enumerated categories with definitions**: Each category includes a one-sentence definition ("Something that used to work is now broken, or behaves unexpectedly"). This disambiguates edge cases — for example, "I can't log in" could be a bug report OR a technical question depending on context. The definitions guide the model toward consistent classification.

**Confidence scoring rubric**: Rather than letting the model self-calibrate, the prompt provides explicit score ranges (90-100, 70-89, below 70). This anchors the model's confidence estimates to our escalation threshold (70%) and produces more consistent scores across requests.

**Separate urgency from priority**: Priority is for internal routing ("how fast should we respond?") while urgency is the customer's perceived urgency ("how upset/blocked are they?"). A low-priority feature request could still have high urgency if the customer is in active evaluation. Separating these gives the receiving team more nuanced context.

**billingAmounts as a dedicated field**: The escalation logic needs to check billing amounts against a $500 threshold. Rather than parsing the summary or raw message, the prompt explicitly asks the model to extract dollar amounts as numbers. This is more reliable than regex alone because the model understands context (e.g., "$500 credit" vs. "$500 overcharge").

**No few-shot examples**: The prompt relies on clear instructions rather than examples. For this schema complexity, instructions are more token-efficient than examples. With more time, adding 1-2 few-shot examples could improve edge case handling, but risks anchoring the model to the example patterns.

---

## User Prompt

```
Analyze this customer support request and return the structured JSON assessment.

Source channel: ${source}

Customer message:
${message}
```

### Design Choices

**Source channel as context**: The source (Email, Web Form, Support Portal) is provided because it affects interpretation. Email tends to be more detailed and conversational. Web forms are often shorter and more direct. Support portal messages come from users who already have accounts and may reference internal concepts. This context helps the model calibrate urgency and extract the right identifiers.

**Minimal framing**: The user prompt is intentionally brief. The system prompt carries all the instructions; the user prompt just provides the data. This keeps each request's token count low while maintaining the full instruction set across requests.

**Raw message, not sanitized**: The customer's message is passed verbatim, including typos, formatting, and informal language. Sanitizing could strip important signals (e.g., ALL CAPS indicates urgency, specific error codes could be mangled).

---

## What I'd Change With More Time

1. **Add few-shot examples**: Include 2-3 example request/response pairs in the system prompt, covering edge cases like messages that span multiple categories. This would improve consistency on ambiguous inputs.

2. **Structured output mode**: Use the LLM provider's tool-use or JSON mode feature to define the output schema, rather than asking for raw JSON in the prompt. This provides guaranteed schema conformance and eliminates JSON parsing failures entirely.

3. **Chain-of-thought before classification**: Ask the model to think step-by-step before producing the JSON (using an internal scratchpad that doesn't appear in the output). This would improve accuracy on ambiguous messages at the cost of higher latency and token usage.

4. **Per-category prompt tuning**: Analyze classification errors by category and add targeted instructions for common failure modes (e.g., "Messages about SSO/authentication should be classified as Technical Question unless the user reports it's currently broken, in which case it's a Bug Report").

5. **Dynamic prompt context**: Include recent triage history or known incidents in the prompt so the model can correlate new requests with ongoing issues (e.g., "We're currently experiencing a dashboard outage — any reports about dashboard loading issues should be classified as Incident/Outage with high confidence").
