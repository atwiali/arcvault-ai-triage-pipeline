/**
 * Shared Groq SDK mock factory.
 * Provides a properly constructable mock class for the Groq client.
 */

import { vi } from "vitest";

export const mockCreate = vi.fn();

export function setupGroqMock() {
  vi.mock("groq-sdk", () => {
    return {
      default: class MockGroq {
        chat = {
          completions: {
            create: mockCreate,
          },
        };
        constructor(_opts?: unknown) {}
      },
    };
  });
}
