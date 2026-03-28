/**
 * Prompt injection detection service.
 * Scans incoming messages for patterns that attempt to override, leak, or
 * manipulate the LLM's system instructions. Runs before the message is
 * sent to the classifier.
 *
 * Detection strategy: layered pattern matching with a scoring system.
 * Each detected pattern adds to a threat score. Messages that exceed
 * the threshold are flagged and can be blocked or auto-escalated.
 */

import { logger } from "../utils/logger";

export interface PromptGuardResult {
  /** Whether the message is considered safe to send to the LLM. */
  safe: boolean;
  /** Total threat score (0 = clean, higher = more suspicious). */
  threatScore: number;
  /** List of matched threat patterns with descriptions. */
  detections: string[];
}

interface ThreatPattern {
  /** Regex to match against the lowercased message. */
  pattern: RegExp;
  /** Human-readable description of what this pattern detects. */
  description: string;
  /** Score contribution when this pattern matches. */
  score: number;
}

/** Threat score at or above this value flags the message as unsafe. */
const THREAT_THRESHOLD = 3;

/**
 * Layered detection patterns ordered by severity.
 * Each pattern targets a known prompt injection technique.
 */
const THREAT_PATTERNS: ThreatPattern[] = [
  // --- Role override attempts (high severity) ---
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier|preceding)\s+(instructions?|prompts?|rules?|directives?)/i,
    description: "Role override: ignore previous instructions",
    score: 5,
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|rules?|guidelines?)/i,
    description: "Role override: disregard instructions",
    score: 5,
  },
  {
    pattern: /forget\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|rules?|context)/i,
    description: "Role override: forget instructions",
    score: 5,
  },
  {
    pattern: /you\s+are\s+now\s+(a|an|the|my)\s+/i,
    description: "Role override: identity reassignment",
    score: 5,
  },
  {
    pattern: /act\s+as\s+(a|an|if\s+you\s+are|though\s+you\s+are)\s+/i,
    description: "Role override: act-as injection",
    score: 4,
  },
  {
    pattern: /switch\s+(to|into)\s+(a\s+)?(\w+\s+)?mode/i,
    description: "Role override: mode switch attempt",
    score: 4,
  },
  {
    pattern: /enter(?:ing)?\s+(?:a\s+)?(?:\w+\s+)*(new|different|special|dev|debug|admin)\s+mode/i,
    description: "Role override: mode entry attempt",
    score: 4,
  },

  // --- System prompt extraction (high severity) ---
  {
    pattern: /(?:what|show|reveal|print|display|output|repeat|tell\s+me)\s+(?:is\s+)?(?:your|the)\s+system\s+prompt/i,
    description: "Prompt leak: system prompt extraction",
    score: 5,
  },
  {
    pattern: /(?:repeat|echo|print|show|output|display)\s+(?:your\s+)?(?:instructions?|system\s+message|initial\s+prompt|original\s+prompt)/i,
    description: "Prompt leak: instruction extraction",
    score: 5,
  },
  {
    pattern: /what\s+(?:were|are)\s+your\s+(?:original\s+)?(?:instructions?|directives?|rules?)/i,
    description: "Prompt leak: instruction query",
    score: 4,
  },

  // --- Instruction injection (medium-high severity) ---
  {
    pattern: /\[?\s*system\s*\]?\s*:/i,
    description: "Injection: fake system message delimiter",
    score: 4,
  },
  {
    pattern: /```\s*system/i,
    description: "Injection: system block in code fence",
    score: 4,
  },
  {
    pattern: /<<\s*(?:system|instruction|prompt)\s*>>/i,
    description: "Injection: XML-style system tag",
    score: 4,
  },
  {
    pattern: /<\s*(?:system|instruction|prompt)\s*>/i,
    description: "Injection: HTML-style system tag",
    score: 3,
  },
  {
    pattern: /new\s+instructions?\s*:/i,
    description: "Injection: new instructions declaration",
    score: 4,
  },
  {
    pattern: /(?:updated|revised|override|replacement)\s+(?:system\s+)?instructions?\s*:/i,
    description: "Injection: instruction override declaration",
    score: 5,
  },

  // --- Output manipulation (medium severity) ---
  {
    pattern: /(?:always|must)\s+(?:respond|reply|answer|output)\s+with/i,
    description: "Output manipulation: forced response pattern",
    score: 3,
  },
  {
    pattern: /respond\s+(?:only\s+)?(?:with|in)\s+(?:the\s+following|this)\s*:/i,
    description: "Output manipulation: response override",
    score: 3,
  },
  {
    pattern: /return\s+(?:only\s+)?(?:the\s+following|this)\s+(?:json|text|response)\s*:/i,
    description: "Output manipulation: return value override",
    score: 3,
  },
  {
    pattern: /set\s+(?:the\s+)?(?:category|priority|confidence\s*score|urgency)\s+(?:to|as|=)/i,
    description: "Output manipulation: field value override attempt",
    score: 3,
  },

  // --- Jailbreak / DAN patterns (high severity) ---
  {
    pattern: /\bDAN\b.*(?:mode|prompt|jailbreak)/i,
    description: "Jailbreak: DAN-style attack",
    score: 5,
  },
  {
    pattern: /(?:do\s+anything\s+now|developer\s+mode|god\s+mode|unrestricted\s+mode)/i,
    description: "Jailbreak: unrestricted mode attempt",
    score: 5,
  },
  {
    pattern: /(?:bypass|circumvent|override|disable)\s+(?:your\s+)?(?:safety|security|filter|restriction|guardrail|limitation)/i,
    description: "Jailbreak: safety bypass attempt",
    score: 5,
  },

  // --- Delimiter / context confusion (medium severity) ---
  {
    pattern: /---+\s*(?:end|begin|start)\s+(?:of\s+)?(?:system|user|assistant|prompt|instruction)/i,
    description: "Context confusion: fake delimiter",
    score: 3,
  },
  {
    pattern: /(?:end_turn|<\|im_end\|>|<\|im_start\|>|<\|endoftext\|>)/i,
    description: "Context confusion: special token injection",
    score: 5,
  },
];

/**
 * Scans a message for prompt injection patterns.
 * Returns a result with safety status, threat score, and matched patterns.
 */
export const detectInjection = (message: string): PromptGuardResult => {
  const detections: string[] = [];
  let threatScore = 0;

  for (const { pattern, description, score } of THREAT_PATTERNS) {
    if (pattern.test(message)) {
      detections.push(description);
      threatScore += score;
    }
  }

  const safe = threatScore < THREAT_THRESHOLD;

  if (!safe) {
    logger.warn(
      `Prompt injection detected (score: ${threatScore}): [${detections.join("; ")}]`
    );
  }

  return { safe, threatScore, detections };
};
