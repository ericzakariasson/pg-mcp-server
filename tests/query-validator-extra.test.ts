import { describe, test, expect } from "bun:test";
import { QueryValidator } from "../src/query-validator";
import type { Logger } from "../src/logger";
import { ConsoleLogger } from "../src/logger";
import { QueryValidationError } from "../src/types";

class TestLogger implements Logger {
  public warnings: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public infos: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public debugs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public errors: Array<{ message: string; error?: unknown }> = [];

  error(message: string, error?: unknown): void {
    this.errors.push({ message, error });
  }
  warn(message: string, context?: Record<string, unknown>): void {
    this.warnings.push({ message, context });
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.infos.push({ message, context });
  }
  debug(message: string, context?: Record<string, unknown>): void {
    this.debugs.push({ message, context });
  }
}

describe("QueryValidator edge cases", () => {
  test("allows parentheses-leading SELECT in read-only", () => {
    const validator = new QueryValidator(false, new ConsoleLogger(false));
    expect(() => validator.validate("(SELECT 1)"))
      .not.toThrow();
  });

  test("allows mixed-case and leading whitespace SELECT", () => {
    const validator = new QueryValidator(false, new ConsoleLogger(false));
    expect(() => validator.validate("   SeLeCt 1"))
      .not.toThrow();
  });

  test("does not split on semicolons inside strings", () => {
    const validator = new QueryValidator(false, new ConsoleLogger(false));
    expect(() => validator.validate("SELECT 'a;b' AS x"))
      .not.toThrow();
  });

  test("ignores write keywords inside comments in read-only", () => {
    const validator = new QueryValidator(false, new ConsoleLogger(false));
    const sql = `-- DROP TABLE users\nSELECT 1; /* delete from t */`;
    expect(() => validator.validate(sql))
      .not.toThrow();
  });

  test("blocks WITH containing write operations in read-only", () => {
    const validator = new QueryValidator(false, new ConsoleLogger(false));
    expect(() => validator.validate("WITH t AS (DELETE FROM u) SELECT 1"))
      .toThrow(QueryValidationError);
  });

  test("allows WITH without write operations in read-only", () => {
    const validator = new QueryValidator(false, new ConsoleLogger(false));
    const sql = `WITH t AS (SELECT 1 AS x) SELECT * FROM t`;
    expect(() => validator.validate(sql))
      .not.toThrow();
  });

  test("warns on suspicious patterns and throws on write in read-only", () => {
    const logger = new TestLogger();
    const validator = new QueryValidator(false, logger);
    expect(() => validator.validate("SELECT 1; DROP TABLE x"))
      .toThrow(QueryValidationError);

    expect(logger.warnings.length).toBeGreaterThan(0);
  });

  test("allows multiple read-only statements; blocks when a write appears", () => {
    const validator = new QueryValidator(false, new ConsoleLogger(false));
    expect(() => validator.validate("SELECT 1; SELECT 2"))
      .not.toThrow();
    expect(() => validator.validate("SELECT 1; INSERT INTO t VALUES (1)"))
      .toThrow(QueryValidationError);
  });
});


