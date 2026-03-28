/**
 * Rate limiting middleware.
 * Prevents abuse by limiting the number of requests per IP within a time window.
 */

import rateLimit from "express-rate-limit";

/** General rate limiter — 100 requests per 15 minutes per IP. */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

/** Strict limiter for the ingest endpoint — 30 requests per minute per IP. */
export const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for ingest endpoint. Please try again later." },
});
