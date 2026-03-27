/**
 * Output service.
 * Writes structured triage results to JSON files in the output/ directory.
 * Supports both bulk writes (for /process-all) and single appends (for /webhook/ingest).
 */

import fs from "fs/promises";
import path from "path";
import { TriageOutput } from "../types";
import { logger } from "../utils/logger";

const OUTPUT_DIR = path.join(process.cwd(), "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "triage-results.json");

/** Ensures the output directory exists before writing. */
const ensureOutputDir = async (): Promise<void> => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
};

/** Writes an array of triage results to the output file, replacing any existing content. */
export const writeTriageOutput = async (results: TriageOutput[]): Promise<void> => {
  try {
    await ensureOutputDir();
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf-8");
    logger.info(`Wrote ${results.length} triage results to ${OUTPUT_FILE}`);
  } catch (error) {
    logger.error("Failed to write triage output", error);
  }
};

/** Appends a single triage result to the existing output file. Creates the file if it doesn't exist. */
export const appendTriageOutput = async (result: TriageOutput): Promise<void> => {
  try {
    await ensureOutputDir();

    let existing: TriageOutput[] = [];
    try {
      const content = await fs.readFile(OUTPUT_FILE, "utf-8");
      existing = JSON.parse(content) as TriageOutput[];
    } catch {
      // File doesn't exist or is invalid — start fresh
    }

    existing.push(result);
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(existing, null, 2), "utf-8");
    logger.info(`Appended triage result ${result.id} to ${OUTPUT_FILE}`);
  } catch (error) {
    logger.error("Failed to append triage output", error);
  }
};
