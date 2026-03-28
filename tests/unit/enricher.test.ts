import { describe, it, expect } from "vitest";
import { extractEnrichment } from "../../src/services/enricher";
import { LLMTriageResponse } from "../../src/types";

describe("extractEnrichment", () => {
  it("extracts coreIssue, identifiers, and urgencySignal from LLM response", () => {
    const llmResponse: LLMTriageResponse = {
      category: "Bug Report",
      priority: "High",
      confidenceScore: 92,
      coreIssue: "User cannot login due to 403 error",
      identifiers: ["ERR-403", "user-12345"],
      urgencySignal: "High",
      billingAmounts: [],
      summary: "Login failure with 403 error for user-12345",
    };

    const result = extractEnrichment(llmResponse);

    expect(result).toEqual({
      coreIssue: "User cannot login due to 403 error",
      identifiers: ["ERR-403", "user-12345"],
      urgencySignal: "High",
    });
  });

  it("handles empty identifiers array", () => {
    const llmResponse: LLMTriageResponse = {
      category: "Feature Request",
      priority: "Low",
      confidenceScore: 85,
      coreIssue: "User wants bulk export",
      identifiers: [],
      urgencySignal: "Low",
      billingAmounts: [],
      summary: "Feature request for bulk export",
    };

    const result = extractEnrichment(llmResponse);

    expect(result.identifiers).toEqual([]);
    expect(result.urgencySignal).toBe("Low");
  });

  it("does not include classification or billing fields", () => {
    const llmResponse: LLMTriageResponse = {
      category: "Billing Issue",
      priority: "Medium",
      confidenceScore: 95,
      coreIssue: "Invoice mismatch",
      identifiers: ["INV-9876"],
      urgencySignal: "Medium",
      billingAmounts: [1240, 980],
      summary: "Billing discrepancy on invoice",
    };

    const result = extractEnrichment(llmResponse);

    expect(result).not.toHaveProperty("category");
    expect(result).not.toHaveProperty("priority");
    expect(result).not.toHaveProperty("confidenceScore");
    expect(result).not.toHaveProperty("billingAmounts");
    expect(result).not.toHaveProperty("summary");
  });
});
