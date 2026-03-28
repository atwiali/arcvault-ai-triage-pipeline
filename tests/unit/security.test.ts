/**
 * Security-specific tests.
 * Validates that security middleware behaves correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { mockCreate, setupGroqMock } from "../__mocks__/groqMock";

setupGroqMock();

// Mock the output service
vi.mock("../../src/services/output", () => ({
  writeTriageOutput: vi.fn().mockResolvedValue(undefined),
  appendTriageOutput: vi.fn().mockResolvedValue(undefined),
}));

import { app } from "../../src/index";

const validLLMResponse = {
  category: "Bug Report",
  priority: "Medium",
  confidenceScore: 90,
  coreIssue: "Test issue",
  identifiers: [],
  urgencySignal: "Medium",
  billingAmounts: [],
  summary: "Test summary",
};

describe("Security: Input sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validLLMResponse) } }],
    });
  });

  it("strips HTML tags from message", async () => {
    const res = await request(app)
      .post("/webhook/ingest")
      .send({
        source: "Email",
        message: "Hello <script>alert('xss')</script> world",
      });

    expect(res.status).toBe(200);
    expect(res.body.rawMessage).not.toContain("<script>");
    expect(res.body.rawMessage).toContain("Hello");
    expect(res.body.rawMessage).toContain("world");
  });

  it("strips HTML tags from source field", async () => {
    const res = await request(app)
      .post("/webhook/ingest")
      .send({
        source: "Email<img src=x onerror=alert(1)>",
        message: "Normal message",
      });

    expect(res.status).toBe(200);
    expect(res.body.source).not.toContain("<img");
  });

  it("rejects messages exceeding maximum length", async () => {
    const longMessage = "a".repeat(10_001);
    const res = await request(app)
      .post("/webhook/ingest")
      .send({ source: "Email", message: longMessage });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("maximum length");
  });

  it("allows messages at exactly maximum length", async () => {
    const maxMessage = "a".repeat(10_000);
    const res = await request(app)
      .post("/webhook/ingest")
      .send({ source: "Email", message: maxMessage });

    expect(res.status).toBe(200);
  });
});

describe("Security: HTTP headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validLLMResponse) } }],
    });
  });

  it("sets security headers via Helmet", async () => {
    const res = await request(app)
      .post("/webhook/ingest")
      .send({ source: "Email", message: "Test" });

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });
});

describe("Security: Request body limits", () => {
  it("rejects payloads exceeding the 100kb body limit", async () => {
    const hugePayload = { source: "Email", message: "x".repeat(200_000) };
    const res = await request(app)
      .post("/webhook/ingest")
      .send(hugePayload);

    // Express returns 413 or the global error handler catches it as 500
    expect([413, 500]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });
});

describe("Security: Authentication", () => {
  it("allows requests when no API_KEY is configured (dev mode)", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validLLMResponse) } }],
    });

    const res = await request(app)
      .post("/webhook/ingest")
      .send({ source: "Email", message: "Test message" });

    expect(res.status).not.toBe(401);
  });
});
