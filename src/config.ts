import { z } from "zod";
import type { ServerConfig } from "./types.js";
import { ConfigurationError } from "./types.js";

// Helpers to robustly parse env vars
const booleanFromEnv = (defaultValue: boolean) =>
  z.preprocess((val) => {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      const s = val.trim().toLowerCase();
      if (["true", "1", "yes", "on", "y", "t"].includes(s)) return true;
      if (["false", "0", "no", "off", "", "n", "f"].includes(s)) return false;
      return undefined;
    }
    return undefined;
  }, z.boolean().default(defaultValue));

const intFromEnv = (defaultValue: number, min?: number, max?: number) => {
  let numberSchema: z.ZodNumber = z.number().int();
  if (typeof min === "number") numberSchema = numberSchema.min(min);
  if (typeof max === "number") numberSchema = numberSchema.max(max);

  return z.preprocess((val) => {
    if (typeof val === "number") {
      return Number.isFinite(val) ? Math.trunc(val) : undefined;
    }
    if (typeof val === "string") {
      const n = Number(val);
      return Number.isFinite(n) ? Math.trunc(n) : undefined;
    }
    return undefined;
  }, numberSchema.default(defaultValue));
};

// Zod schema for environment variables
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DANGEROUSLY_ALLOW_WRITE_OPS: booleanFromEnv(false),
  PG_MAX_CONNECTIONS: intFromEnv(10, 1, 100),
  PG_CONNECTION_TIMEOUT: intFromEnv(30, 1, 300),
  PG_STATEMENT_TIMEOUT: intFromEnv(30000, 0),
  PG_PREPARE_STATEMENTS: booleanFromEnv(true),
  DEBUG: booleanFromEnv(false),
  PG_SSL_ROOT_CERT: z.string().optional(),
  PG_REQUIRE_SSL: booleanFromEnv(false),
  PG_SSL_REJECT_UNAUTHORIZED: booleanFromEnv(true),
  PG_FETCH_TYPES: booleanFromEnv(true),
});

// Zod schema for the final config
const ConfigSchema = z.object({
  databaseUrl: z.string(),
  currentSchema: z.string().optional(),
  allowWriteOps: z.boolean(),
  maxConnections: z.number().min(1).max(100),
  connectionTimeout: z.number().min(1).max(300),
  statementTimeout: z.number().min(0),
  prepareStatements: z.boolean(),
  debug: z.boolean(),
  sslRootCertPath: z.string().optional(),
  requireSsl: z.boolean().optional(),
  sslRejectUnauthorized: z.boolean().optional(),
  fetchTypes: z.boolean().optional(),
});

/**
 * Extract schema parameter from DATABASE_URL
 * Supports currentSchema, schema, and search_path parameters
 */
function extractSchemaFromUrl(url: string): {
  cleanUrl: string;
  currentSchema?: string;
} {
  try {
    const urlObj = new URL(url);

    // Check for schema parameters (in order of preference)
    const currentSchema =
      urlObj.searchParams.get("currentSchema") ||
      urlObj.searchParams.get("schema") ||
      urlObj.searchParams.get("search_path");

    if (currentSchema) {
      // Remove the schema parameter from the URL
      urlObj.searchParams.delete("currentSchema");
      urlObj.searchParams.delete("schema");
      urlObj.searchParams.delete("search_path");

      return {
        cleanUrl: urlObj.toString(),
        currentSchema,
      };
    }

    return { cleanUrl: url };
  } catch {
    // If URL parsing fails, return the original URL
    return { cleanUrl: url };
  }
}

/**
 * Parse and validate server configuration from environment variables
 */
export function loadConfig(): ServerConfig {
  try {
    // Parse environment variables using Zod
    const env = EnvSchema.parse(process.env);

    // Extract schema parameter from DATABASE_URL
    const { cleanUrl, currentSchema } = extractSchemaFromUrl(env.DATABASE_URL);

    // Create config object
    const config = {
      databaseUrl: cleanUrl,
      currentSchema,
      allowWriteOps: env.DANGEROUSLY_ALLOW_WRITE_OPS,
      maxConnections: env.PG_MAX_CONNECTIONS,
      connectionTimeout: env.PG_CONNECTION_TIMEOUT,
      statementTimeout: env.PG_STATEMENT_TIMEOUT,
      prepareStatements: env.PG_PREPARE_STATEMENTS,
      debug: env.DEBUG,
      sslRootCertPath: env.PG_SSL_ROOT_CERT,
      requireSsl: env.PG_REQUIRE_SSL ? true : undefined,
      sslRejectUnauthorized: env.PG_SSL_REJECT_UNAUTHORIZED ? true : undefined,
      fetchTypes: env.PG_FETCH_TYPES,
    };

    // Validate the final config
    const validatedConfig = ConfigSchema.parse(config);
    return validatedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      throw new ConfigurationError(
        `Configuration validation failed: ${errorMessage}`
      );
    }
    throw error;
  }
}

/**
 * Validate configuration values
 */
export function validateConfig(config: ServerConfig): void {
  try {
    ConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      throw new ConfigurationError(
        `Configuration validation failed: ${errorMessage}`
      );
    }
    throw error;
  }
}
