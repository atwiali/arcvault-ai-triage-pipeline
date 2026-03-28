/**
 * Security headers and CORS configuration.
 * Combines Helmet for HTTP security headers and CORS for cross-origin control.
 */

import helmet from "helmet";
import cors from "cors";
import { RequestHandler } from "express";

/** Helmet middleware — sets secure HTTP headers (XSS protection, no-sniff, etc). */
export const securityHeaders: RequestHandler = helmet();

/** CORS middleware — restricts origins in production, allows all in development. */
export const corsMiddleware: RequestHandler = cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : "*",
  methods: ["POST"],
  allowedHeaders: ["Content-Type", "x-api-key"],
  maxAge: 86400,
});
