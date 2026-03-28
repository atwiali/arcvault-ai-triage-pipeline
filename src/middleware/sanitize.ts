/**
 * Input sanitization middleware.
 * Strips potentially dangerous content from request bodies
 * to mitigate XSS and injection attacks.
 */

import { Request, Response, NextFunction } from "express";

/** Strips HTML tags and trims whitespace from a string. */
const sanitizeString = (input: string): string => {
  return input.replace(/<[^>]*>/g, "").trim();
};

/** Recursively sanitizes all string values in an object. */
const sanitizeObject = (obj: unknown): unknown => {
  if (typeof obj === "string") return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj !== null && typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
};

/**
 * Sanitizes all string fields in the request body.
 * Also enforces a maximum message length to prevent abuse.
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const MAX_MESSAGE_LENGTH = 10_000;

  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);

    if (req.body.message && typeof req.body.message === "string") {
      if (req.body.message.length > MAX_MESSAGE_LENGTH) {
        res.status(400).json({
          error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters.`,
        });
        return;
      }
    }
  }

  next();
};
