import { describe, it, expect } from "vitest";
import { checkEscalation } from "../../src/services/escalation";
import { ClassificationResult, LLMTriageResponse } from "../../src/types";

const makeClassification = (overrides: Partial<ClassificationResult> = {}): ClassificationResult => ({
  category: "Bug Report",
  priority: "Medium",
  confidenceScore: 90,
  ...overrides,
});

const makeLLMResponse = (overrides: Partial<LLMTriageResponse> = {}): LLMTriageResponse => ({
  category: "Bug Report",
  priority: "Medium",
  confidenceScore: 90,
  coreIssue: "Test issue",
  identifiers: [],
  urgencySignal: "Medium",
  billingAmounts: [],
  summary: "Test summary",
  ...overrides,
});

describe("checkEscalation", () => {
  it("does not escalate a normal request", () => {
    const result = checkEscalation(
      "I have a question about my account",
      makeClassification(),
      makeLLMResponse()
    );
    expect(result.escalationFlag).toBe(false);
    expect(result.escalationReason).toBeNull();
  });

  it("escalates when confidence score is below threshold", () => {
    const result = checkEscalation(
      "Some message",
      makeClassification({ confidenceScore: 50 }),
      makeLLMResponse({ confidenceScore: 50 })
    );
    expect(result.escalationFlag).toBe(true);
    expect(result.escalationReason).toContain("Low confidence score");
  });

  it("escalates when message contains 'outage' keyword", () => {
    const result = checkEscalation(
      "There is a major outage happening right now",
      makeClassification(),
      makeLLMResponse()
    );
    expect(result.escalationFlag).toBe(true);
    expect(result.escalationReason).toContain("outage");
  });

  it("escalates when message contains 'down for all users'", () => {
    const result = checkEscalation(
      "The dashboard is down for all users",
      makeClassification(),
      makeLLMResponse()
    );
    expect(result.escalationFlag).toBe(true);
    expect(result.escalationReason).toContain("down for all users");
  });

  it("escalates when message contains 'multiple users affected'", () => {
    const result = checkEscalation(
      "Login is broken, multiple users affected",
      makeClassification(),
      makeLLMResponse()
    );
    expect(result.escalationFlag).toBe(true);
    expect(result.escalationReason).toContain("multiple users affected");
  });

  it("escalates when LLM-extracted billing amount exceeds threshold", () => {
    const result = checkEscalation(
      "My invoice is wrong",
      makeClassification(),
      makeLLMResponse({ billingAmounts: [750] })
    );
    expect(result.escalationFlag).toBe(true);
    expect(result.escalationReason).toContain("Billing discrepancy");
  });

  it("escalates when regex-extracted dollar amount exceeds threshold", () => {
    const result = checkEscalation(
      "I was charged $1,240 instead of $980",
      makeClassification(),
      makeLLMResponse()
    );
    expect(result.escalationFlag).toBe(true);
    expect(result.escalationReason).toContain("Billing discrepancy");
  });

  it("does not escalate when billing amount is at or below threshold", () => {
    const result = checkEscalation(
      "I was charged $500",
      makeClassification(),
      makeLLMResponse({ billingAmounts: [500] })
    );
    expect(result.escalationFlag).toBe(false);
  });

  it("combines multiple escalation reasons", () => {
    const result = checkEscalation(
      "There is an outage and I was charged $1,000",
      makeClassification({ confidenceScore: 40 }),
      makeLLMResponse({ confidenceScore: 40, billingAmounts: [1000] })
    );
    expect(result.escalationFlag).toBe(true);
    expect(result.escalationReason).toContain("Low confidence score");
    expect(result.escalationReason).toContain("outage");
    expect(result.escalationReason).toContain("Billing discrepancy");
  });

  it("keyword matching is case-insensitive", () => {
    const result = checkEscalation(
      "OUTAGE on the production server!",
      makeClassification(),
      makeLLMResponse()
    );
    expect(result.escalationFlag).toBe(true);
  });
});
