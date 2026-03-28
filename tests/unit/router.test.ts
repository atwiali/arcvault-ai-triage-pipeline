import { describe, it, expect } from "vitest";
import { routeRequest } from "../../src/services/router";
import { ClassificationResult } from "../../src/types";

describe("routeRequest", () => {
  it("routes Bug Report to Engineering", () => {
    const classification: ClassificationResult = {
      category: "Bug Report",
      priority: "Medium",
      confidenceScore: 90,
    };
    expect(routeRequest(classification)).toBe("Engineering");
  });

  it("routes Incident/Outage to Engineering", () => {
    const classification: ClassificationResult = {
      category: "Incident/Outage",
      priority: "High",
      confidenceScore: 95,
    };
    expect(routeRequest(classification)).toBe("Engineering");
  });

  it("routes Feature Request to Product", () => {
    const classification: ClassificationResult = {
      category: "Feature Request",
      priority: "Low",
      confidenceScore: 85,
    };
    expect(routeRequest(classification)).toBe("Product");
  });

  it("routes Billing Issue to Billing", () => {
    const classification: ClassificationResult = {
      category: "Billing Issue",
      priority: "Medium",
      confidenceScore: 80,
    };
    expect(routeRequest(classification)).toBe("Billing");
  });

  it("routes Technical Question to IT/Security", () => {
    const classification: ClassificationResult = {
      category: "Technical Question",
      priority: "Low",
      confidenceScore: 75,
    };
    expect(routeRequest(classification)).toBe("IT/Security");
  });

  it("falls back to General Triage when confidence is below threshold", () => {
    const classification: ClassificationResult = {
      category: "Bug Report",
      priority: "High",
      confidenceScore: 50,
    };
    expect(routeRequest(classification)).toBe("General Triage");
  });

  it("falls back to General Triage when confidence is exactly at threshold boundary", () => {
    const classification: ClassificationResult = {
      category: "Bug Report",
      priority: "Medium",
      confidenceScore: 69,
    };
    expect(routeRequest(classification)).toBe("General Triage");
  });

  it("routes normally when confidence equals threshold", () => {
    const classification: ClassificationResult = {
      category: "Bug Report",
      priority: "Medium",
      confidenceScore: 70,
    };
    expect(routeRequest(classification)).toBe("Engineering");
  });
});
