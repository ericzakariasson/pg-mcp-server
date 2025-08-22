import { QueryValidationError } from "./types.js";
import type { Logger } from "./logger.js";

// Expanded list of write operations to check
const WRITE_OPERATIONS = new Set([
  "insert",
  "update",
  "delete",
  "truncate",
  "drop",
  "alter",
  "create",
  "grant",
  "revoke",
  "import",
  "copy",
  "merge",
  "upsert",
  "replace",
]);

// Keywords that are safe even at the start of a statement
const SAFE_KEYWORDS = new Set([
  "select",
  "with",
  "show",
  "explain",
  "values",
  "table",
  "describe",
  "desc",
]);

export class QueryValidator {
  constructor(
    private readonly allowWriteOps: boolean,
    private readonly logger: Logger,
  ) {}

  /**
   * Validate a SQL query for safety and correctness
   */
  validate(query: string): void {
    if (!query || query.trim().length === 0) {
      throw new QueryValidationError("Query cannot be empty");
    }

    // Check for common SQL injection patterns
    this.checkForSqlInjection(query);

    // Check write operations if not allowed
    if (!this.allowWriteOps) {
      this.checkReadOnly(query);
    }

    this.logger.debug("Query validated successfully", {
      queryLength: query.length,
      allowWriteOps: this.allowWriteOps,
    });
  }

  /**
   * Basic SQL injection detection
   */
  private checkForSqlInjection(query: string): void {
    // Check for common SQL injection patterns
    const suspiciousPatterns = [
      /;\s*drop\s+/i,
      /;\s*delete\s+from\s+/i,
      /union\s+all\s+select\s+null/i,
      /\/\*.*\*\/\s*drop/i,
      /--.*drop\s+/i,
      /xp_cmdshell/i,
      /exec\s*\(/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(query)) {
        this.logger.warn("Suspicious SQL pattern detected", {
          pattern: pattern.toString(),
          query: query.substring(0, 100),
        });
      }
    }
  }

  /**
   * Check if query contains write operations
   */
  private checkReadOnly(query: string): void {
    // Split by semicolons and check each statement
    const statements = this.splitStatements(query);

    for (const statement of statements) {
      if (this.isWriteStatement(statement)) {
        throw new QueryValidationError(
          "Write operations are disabled. Consult a human to enable this.",
        );
      }
    }
  }

  /**
   * Split SQL query into individual statements
   */
  private splitStatements(query: string): string[] {
    const statements: string[] = [];
    let current = "";
    let inString = false;
    let stringDelimiter = "";
    let inComment = false;
    let inBlockComment = false;

    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      const nextChar = query[i + 1];

      // Handle block comments
      if (!inString && !inComment && char === "/" && nextChar === "*") {
        inBlockComment = true;
        current += char;
        continue;
      }
      if (inBlockComment && char === "*" && nextChar === "/") {
        inBlockComment = false;
        current += char;
        i++; // Skip next char
        current += query[i];
        continue;
      }

      // Handle line comments
      if (!inString && !inBlockComment && char === "-" && nextChar === "-") {
        inComment = true;
        current += char;
        continue;
      }
      if (inComment && char === "\n") {
        inComment = false;
        current += char;
        continue;
      }

      // Handle strings
      if (!inComment && !inBlockComment && (char === "'" || char === '"')) {
        if (!inString) {
          inString = true;
          stringDelimiter = char;
        } else if (char === stringDelimiter) {
          // Check for escaped quotes
          if (nextChar !== char) {
            inString = false;
            stringDelimiter = "";
          } else {
            // Skip escaped quote
            current += char;
            i++;
          }
        }
      }

      // Handle statement separation
      if (!inString && !inComment && !inBlockComment && char === ";") {
        if (current.trim()) {
          statements.push(current.trim());
        }
        current = "";
      } else {
        current += char;
      }
    }

    // Add last statement if any
    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements;
  }

  /**
   * Check if a single statement is a write operation
   */
  private isWriteStatement(statement: string): boolean {
    const trimmed = statement.trim();
    if (!trimmed) return false;

    // Remove leading parentheses and whitespace
    const normalized = trimmed.replace(/^\s*\(\s*/g, "");

    // Extract first word
    const firstWordMatch = normalized.match(/^(\w+)/i);
    if (!firstWordMatch) return false;

    const firstWord = firstWordMatch[1]!.toLowerCase();

    // Check if it's a CTE that might contain writes
    if (firstWord === "with") {
      // Simple check: if WITH contains any write keywords, consider it a write
      const lowerStatement = statement.toLowerCase();
      for (const writeOp of WRITE_OPERATIONS) {
        if (lowerStatement.includes(writeOp)) {
          return true;
        }
      }
      return false;
    }

    return !SAFE_KEYWORDS.has(firstWord);
  }
}
