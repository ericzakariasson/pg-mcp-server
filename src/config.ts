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
  currentSchema: z
    .string()
    .regex(
      /^[a-zA-Z_][a-zA-Z0-9_$]*$/,
      "currentSchema must contain only alphanumeric characters, underscores, and dollar signs, starting with a letter or underscore"
    )
    .optional(),
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
 * Supports currentSchema, schema, and search_path parameters.
 *
 * Uses string-level manipulation on the query portion only so the
 * authority (userinfo/host) is left byte-for-byte intact. Going through
 * `new URL().toString()` would percent-encode special characters in the
 * password (e.g. `@` → `%40`), which the `postgres` library has multiple
 * known issues with and can cause authentication failures.
 */
function extractSchemaFromUrl(url: string): {
  cleanUrl: string;
  currentSchema?: string;
} {
  const queryStart = url.indexOf("?");
  if (queryStart === -1) {
    return { cleanUrl: url };
  }

  // Preserve fragment if present (unlikely for DATABASE_URL but cheap to handle)
  const fragmentStart = url.indexOf("#", queryStart);
  const queryEnd = fragmentStart === -1 ? url.length : fragmentStart;

  const base = url.substring(0, queryStart);
  const query = url.substring(queryStart + 1, queryEnd);
  const fragment = fragmentStart === -1 ? "" : url.substring(fragmentStart);

  const schemaKeys = new Set(["currentSchema", "schema", "search_path"]);
  const params = query.length > 0 ? query.split("&") : [];

  let currentSchema: string | undefined;
  const remaining: string[] = [];

  const safeDecode = (value: string): string => {
    try {
      return decodeURIComponent(value.replace(/\+/g, " "));
    } catch {
      return value;
    }
  };

  for (const param of params) {
    const eqIdx = param.indexOf("=");
    const rawKey = eqIdx === -1 ? param : param.substring(0, eqIdx);
    const rawValue = eqIdx === -1 ? "" : param.substring(eqIdx + 1);

    if (schemaKeys.has(safeDecode(rawKey))) {
      // Capture the first schema value we see; drop subsequent schema keys.
      if (currentSchema === undefined) {
        currentSchema = safeDecode(rawValue);
      }
      continue;
    }

    remaining.push(param);
  }

  if (currentSchema === undefined) {
    return { cleanUrl: url };
  }

  const newQuery = remaining.length > 0 ? "?" + remaining.join("&") : "";
  return {
    cleanUrl: base + newQuery + fragment,
    currentSchema,
  };
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
