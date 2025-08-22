import { describe, test, expect } from "bun:test";
import { QueryValidator } from "../src/query-validator";
import { ConsoleLogger } from "../src/logger";
import { QueryValidationError } from "../src/types";

describe("QueryValidator", () => {
  const logger = new ConsoleLogger(false);

  describe("Read-only mode", () => {
    const validator = new QueryValidator(false, logger);

    test("allows SELECT queries", () => {
      expect(() => validator.validate("SELECT * FROM users")).not.toThrow();
      expect(() =>
        validator.validate("select id, name from products"),
      ).not.toThrow();
    });

    test("allows WITH queries", () => {
      expect(() =>
        validator.validate(`
        WITH active_users AS (
          SELECT * FROM users WHERE active = true
        )
        SELECT * FROM active_users
      `),
      ).not.toThrow();
    });

    test("allows EXPLAIN queries", () => {
      expect(() =>
        validator.validate("EXPLAIN SELECT * FROM users"),
      ).not.toThrow();
      expect(() =>
        validator.validate("EXPLAIN ANALYZE SELECT * FROM orders"),
      ).not.toThrow();
    });

    test("blocks INSERT queries", () => {
      expect(() =>
        validator.validate("INSERT INTO users (name) VALUES ('John')"),
      ).toThrow(QueryValidationError);
    });

    test("blocks UPDATE queries", () => {
      expect(() =>
        validator.validate("UPDATE users SET name = 'Jane' WHERE id = 1"),
      ).toThrow(QueryValidationError);
    });

    test("blocks DELETE queries", () => {
      expect(() =>
        validator.validate("DELETE FROM users WHERE id = 1"),
      ).toThrow(QueryValidationError);
    });

    test("blocks DROP queries", () => {
      expect(() => validator.validate("DROP TABLE users")).toThrow(
        QueryValidationError,
      );
    });

    test("handles multiple statements correctly", () => {
      expect(() =>
        validator.validate("SELECT * FROM users; SELECT * FROM orders"),
      ).not.toThrow();

      expect(() =>
        validator.validate("SELECT * FROM users; DELETE FROM orders"),
      ).toThrow(QueryValidationError);
    });

    test("handles comments correctly", () => {
      expect(() =>
        validator.validate(`
        -- This is a comment
        SELECT * FROM users
        /* Block comment */ 
        WHERE active = true
      `),
      ).not.toThrow();
    });

    test("handles string literals correctly", () => {
      expect(() =>
        validator.validate(`
        SELECT * FROM users WHERE name = 'DELETE FROM users'
      `),
      ).not.toThrow();
    });
  });

  describe("Write mode", () => {
    const validator = new QueryValidator(true, logger);

    test("allows all query types", () => {
      expect(() =>
        validator.validate("INSERT INTO users (name) VALUES ('John')"),
      ).not.toThrow();
      expect(() =>
        validator.validate("UPDATE users SET name = 'Jane'"),
      ).not.toThrow();
      expect(() => validator.validate("DELETE FROM users")).not.toThrow();
      expect(() => validator.validate("DROP TABLE users")).not.toThrow();
    });
  });

  describe("Validation", () => {
    const validator = new QueryValidator(false, logger);

    test("rejects empty queries", () => {
      expect(() => validator.validate("")).toThrow(QueryValidationError);
      expect(() => validator.validate("   ")).toThrow(QueryValidationError);
    });

    test("detects basic SQL injection patterns", () => {
      // These should not throw but should log warnings
      expect(() =>
        validator.validate("SELECT * FROM users; DROP TABLE users"),
      ).toThrow(QueryValidationError); // Because DROP is a write operation
    });
  });
});
