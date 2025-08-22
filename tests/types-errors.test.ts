import { describe, test, expect } from "bun:test";
import { PostgresError, ConfigurationError, QueryValidationError } from "../src/types";

describe("Error classes", () => {
  test("PostgresError sets name, code, and detail", () => {
    const err = new PostgresError("boom", "XX000", "detail");
    expect(err.name).toBe("PostgresError");
    expect(err.code).toBe("XX000");
    expect(err.detail).toBe("detail");
    expect(err.message).toBe("boom");
  });

  test("ConfigurationError sets name", () => {
    const err = new ConfigurationError("bad config");
    expect(err.name).toBe("ConfigurationError");
    expect(err.message).toBe("bad config");
  });

  test("QueryValidationError sets name", () => {
    const err = new QueryValidationError("bad query");
    expect(err.name).toBe("QueryValidationError");
    expect(err.message).toBe("bad query");
  });
});


