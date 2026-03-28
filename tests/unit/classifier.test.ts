/**
 * Unit tests for the classifier service.
 * Tests validation, code-fence stripping, and fallback behavior
 * with a mocked Groq client.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockCreate, setupGroqMock } from "../__mocks__/groqMock";

setupGroqMock();

import { classifyAndEnrich } from "../../src/services/classifier";

describe("classifyAndEnrich", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses a valid LLM JSON response", async () => {
    const mockResponse = {
      category: "Bug Report",
      priority: "High",
      confidenceScore: 92,
      coreIssue: "Login 403 error",
      identifiers: ["ERR-403"],
      urgencySignal: "High",
      billingAmounts: [],
      summary: "User experiencing 403 login error",
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    });

    const result = await classifyAndEnrich("I got a 403 error logging in", "Email");

    expect(result.category).toBe("Bug Report");
    expect(result.priority).toBe("High");
    expect(result.confidenceScore).toBe(92);
    expect(result.coreIssue).toBe("Login 403 error");
  });

  it("strips markdown code fences from LLM response", async () => {
    const mockResponse = {
      category: "Feature Request",
      priority: "Low",
      confidenceScore: 88,
      coreIssue: "Wants dark mode",
      identifiers: [],
      urgencySignal: "Low",
      billingAmounts: [],
      summary: "Dark mode feature request",
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "```json\n" + JSON.stringify(mockResponse) + "\n```" } }],
    });

    const result = await classifyAndEnrich("Can you add dark mode?", "Chat");

    expect(result.category).toBe("Feature Request");
    expect(result.confidenceScore).toBe(88);
  });

  it("returns fallback response when LLM returns empty content", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await classifyAndEnrich("Some message", "Email");

    expect(result.confidenceScore).toBe(0);
    expect(result.coreIssue).toContain("Unable to classify");
  });

  it("returns fallback response when LLM call throws", async () => {
    mockCreate.mockRejectedValue(new Error("API timeout"));

    const result = await classifyAndEnrich("Some message", "Email");

    expect(result.confidenceScore).toBe(0);
    expect(result.category).toBe("Bug Report");
    expect(result.summary).toContain("Automated classification failed");
  });

  it("returns fallback response when LLM returns invalid JSON", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "This is not JSON at all" } }],
    });

    const result = await classifyAndEnrich("Some message", "Email");

    expect(result.confidenceScore).toBe(0);
  });

  it("validates and normalizes invalid category values", async () => {
    const mockResponse = {
      category: "InvalidCategory",
      priority: "High",
      confidenceScore: 85,
      coreIssue: "Test",
      identifiers: [],
      urgencySignal: "Medium",
      billingAmounts: [],
      summary: "Test",
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    });

    const result = await classifyAndEnrich("Test", "Email");

    expect(result.category).toBe("Bug Report");
  });

  it("clamps confidence score to valid range", async () => {
    const mockResponse = {
      category: "Bug Report",
      priority: "Medium",
      confidenceScore: 150,
      coreIssue: "Test",
      identifiers: [],
      urgencySignal: "Medium",
      billingAmounts: [],
      summary: "Test",
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    });

    const result = await classifyAndEnrich("Test", "Email");

    expect(result.confidenceScore).toBe(100);
  });

  it("filters non-string identifiers", async () => {
    const mockResponse = {
      category: "Bug Report",
      priority: "Medium",
      confidenceScore: 80,
      coreIssue: "Test",
      identifiers: ["valid-id", 123, null, "another-id"],
      urgencySignal: "Medium",
      billingAmounts: [],
      summary: "Test",
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    });

    const result = await classifyAndEnrich("Test", "Email");

    expect(result.identifiers).toEqual(["valid-id", "another-id"]);
  });
});
