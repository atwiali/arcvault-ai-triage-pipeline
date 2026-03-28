/**
 * API key authentication middleware.
 * Validates requests against a configured API key via the x-api-key header.
 * Skips authentication if no API_KEY is configured (development mode).
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

const API_KEY = process.env.API_KEY ?? "";

/**
 * Validates the x-api-key header against the configured API_KEY.
 * If API_KEY is not set, all requests are allowed (dev mode).
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  if (!API_KEY || process.env.NODE_ENV === "test") {
    next();
    return;
  }

  const providedKey = req.headers["x-api-key"];

  if (!providedKey || providedKey !== API_KEY) {
    logger.warn(`Unauthorized request from ${req.ip} to ${req.path}`);
    res.status(401).json({ error: "Unauthorized — invalid or missing API key." });
    return;
  }

  next();
};
