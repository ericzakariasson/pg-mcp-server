import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig, validateConfig } from "../src/config";
import { ConfigurationError } from "../src/types";

describe("Config boundaries and flags", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (
        key.startsWith("PG_") ||
        key === "DATABASE_URL" ||
        key === "DANGEROUSLY_ALLOW_WRITE_OPS" ||
        key === "PG_PREPARE_STATEMENTS" ||
        key === "DEBUG"
      ) {
        delete (process.env as Record<string, string | undefined>)[key];
      }
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("boundary values: maxConnections 1 and 100; statementTimeout 0", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";

    process.env.PG_MAX_CONNECTIONS = "1";
    let cfg = loadConfig();
    expect(() => validateConfig(cfg)).not.toThrow();

    process.env.PG_MAX_CONNECTIONS = "100";
    cfg = loadConfig();
    expect(() => validateConfig(cfg)).not.toThrow();

    process.env.PG_STATEMENT_TIMEOUT = "0";
    cfg = loadConfig();
    expect(cfg.statementTimeout).toBe(0);
    expect(() => validateConfig(cfg)).not.toThrow();
  });

  test("boolean flag parsing for PG_PREPARE_STATEMENTS and DEBUG", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";

    process.env.PG_PREPARE_STATEMENTS = "false";
    process.env.DEBUG = "true";
    let cfg = loadConfig();
    expect(cfg.prepareStatements).toBe(false);
    expect(cfg.debug).toBe(true);

    process.env.PG_PREPARE_STATEMENTS = "1";
    process.env.DEBUG = "0";
    cfg = loadConfig();
    expect(cfg.prepareStatements).toBe(true);
    expect(cfg.debug).toBe(false);
  });

  test("empty DATABASE_URL yields validation error mentioning field", () => {
    process.env.DATABASE_URL = "";
    expect(() => loadConfig()).toThrow(ConfigurationError);
    try {
      loadConfig();
    } catch (e: any) {
      expect(String(e.message)).toContain("DATABASE_URL");
    }
  });
});


