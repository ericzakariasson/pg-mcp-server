import { describe, test, expect } from "bun:test";
import { DatabaseConnection } from "../src/database";
import { ConsoleLogger } from "../src/logger";
import type { ServerConfig } from "../src/types";

const cfg: ServerConfig = {
  databaseUrl: "postgresql://localhost:5432/test",
  allowWriteOps: false,
  maxConnections: 1,
  connectionTimeout: 1,
  statementTimeout: 0,
  prepareStatements: true,
  debug: false,
};

describe("DatabaseConnection.quoteIdentifier", () => {
  test("escapes double quotes in identifier", () => {
    const db = new DatabaseConnection(cfg, new ConsoleLogger(false));
    // @ts-expect-error private access for test
    expect(db["quoteIdentifier"]('my"table')).toBe('"my""table"');
  });

  test("throws on null byte in identifier", () => {
    const db = new DatabaseConnection(cfg, new ConsoleLogger(false));
    // @ts-expect-error private access for test
    expect(() => db["quoteIdentifier"]("bad\0name")).toThrow("Identifier cannot contain null bytes");
  });
});


