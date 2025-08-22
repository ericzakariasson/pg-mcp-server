import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig, validateConfig } from "../src/config";
import { ConfigurationError } from "../src/types";

describe("Configuration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all environment variables
    Object.keys(process.env).forEach((key) => {
      if (
        key.startsWith("PG_") ||
        key === "DATABASE_URL" ||
        key === "DANGEROUSLY_ALLOW_WRITE_OPS" ||
        key === "DEBUG"
      ) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("loadConfig", () => {
    test("throws error when DATABASE_URL is missing", () => {
      expect(() => loadConfig()).toThrow(ConfigurationError);
    });

    test("loads default configuration", () => {
      process.env.DATABASE_URL = "postgresql://localhost:5432/test";

      const config = loadConfig();

      expect(config.databaseUrl).toBe("postgresql://localhost:5432/test");
      expect(config.allowWriteOps).toBe(false);
      expect(config.maxConnections).toBe(10);
      expect(config.connectionTimeout).toBe(30);
      expect(config.statementTimeout).toBe(30000);
      expect(config.prepareStatements).toBe(true);
      expect(config.debug).toBe(false);
    });

    test("parses boolean values correctly", () => {
      process.env.DATABASE_URL = "postgresql://localhost:5432/test";

      // Test various true values
      ["true", "1", "yes", "on"].forEach((value) => {
        process.env.DANGEROUSLY_ALLOW_WRITE_OPS = value;
        expect(loadConfig().allowWriteOps).toBe(true);
      });

      // Test false values
      ["false", "0", "no", "off", ""].forEach((value) => {
        process.env.DANGEROUSLY_ALLOW_WRITE_OPS = value;
        expect(loadConfig().allowWriteOps).toBe(false);
      });
    });

    test("parses integer values correctly", () => {
      process.env.DATABASE_URL = "postgresql://localhost:5432/test";
      process.env.PG_MAX_CONNECTIONS = "20";
      process.env.PG_CONNECTION_TIMEOUT = "60";
      process.env.PG_STATEMENT_TIMEOUT = "60000";

      const config = loadConfig();

      expect(config.maxConnections).toBe(20);
      expect(config.connectionTimeout).toBe(60);
      expect(config.statementTimeout).toBe(60000);
    });

    test("uses defaults for invalid integer values", () => {
      process.env.DATABASE_URL = "postgresql://localhost:5432/test";
      process.env.PG_MAX_CONNECTIONS = "invalid";
      process.env.PG_CONNECTION_TIMEOUT = "not-a-number";

      const config = loadConfig();

      expect(config.maxConnections).toBe(10);
      expect(config.connectionTimeout).toBe(30);
    });
  });

  describe("validateConfig", () => {
    test("accepts valid configuration", () => {
      const config = {
        databaseUrl: "postgresql://localhost:5432/test",
        allowWriteOps: false,
        maxConnections: 10,
        connectionTimeout: 30,
        statementTimeout: 30000,
        prepareStatements: true,
        debug: false,
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    test("rejects invalid maxConnections", () => {
      const config = {
        databaseUrl: "postgresql://localhost:5432/test",
        allowWriteOps: false,
        maxConnections: 0,
        connectionTimeout: 30,
        statementTimeout: 30000,
        prepareStatements: true,
        debug: false,
      };

      expect(() => validateConfig(config)).toThrow(ConfigurationError);

      config.maxConnections = 101;
      expect(() => validateConfig(config)).toThrow(ConfigurationError);
    });

    test("rejects invalid connectionTimeout", () => {
      const config = {
        databaseUrl: "postgresql://localhost:5432/test",
        allowWriteOps: false,
        maxConnections: 10,
        connectionTimeout: 0,
        statementTimeout: 30000,
        prepareStatements: true,
        debug: false,
      };

      expect(() => validateConfig(config)).toThrow(ConfigurationError);

      config.connectionTimeout = 301;
      expect(() => validateConfig(config)).toThrow(ConfigurationError);
    });

    test("rejects negative statementTimeout", () => {
      const config = {
        databaseUrl: "postgresql://localhost:5432/test",
        allowWriteOps: false,
        maxConnections: 10,
        connectionTimeout: 30,
        statementTimeout: -1,
        prepareStatements: true,
        debug: false,
      };

      expect(() => validateConfig(config)).toThrow(ConfigurationError);
    });
  });
});
