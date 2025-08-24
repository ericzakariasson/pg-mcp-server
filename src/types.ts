import { z } from "zod";

// Schema definitions for tool inputs
export const QueryInputSchema = z.object({
  sql: z.string().min(1, "SQL query cannot be empty"),
});

export type QueryInput = z.infer<typeof QueryInputSchema>;

// Database result types
export interface TableInfo {
  table_schema: string;
  table_name: string;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

export interface TableSchema {
  schema: string;
  table: string;
  columns: ColumnInfo[];
}

export interface TableResource {
  schema: TableSchema;
  sampleRows: Record<string, unknown>[];
}

// MCP Response types
export interface McpToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

export interface McpResourceResponse {
  contents: Array<{
    uri: string;
    text: string;
  }>;
}

// Configuration types
export interface ServerConfig {
  databaseUrl: string;
  allowWriteOps: boolean;
  maxConnections: number;
  connectionTimeout: number;
  statementTimeout: number;
  prepareStatements: boolean;
  debug: boolean;
  sslRootCertPath?: string;
}

// Error types
export class PostgresError extends Error {
  constructor(
    message: string,
    public code?: string,
    public detail?: string,
  ) {
    super(message);
    this.name = "PostgresError";
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class QueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryValidationError";
  }
}
