import postgres from "postgres";
import fs from "node:fs";
import type { Sql } from "postgres";
import type {
  ServerConfig,
  TableInfo,
  ColumnInfo,
  TableResource,
} from "./types.js";
import { PostgresError } from "./types.js";
import type { Logger } from "./logger.js";

/**
 * SSL configuration type compatible with postgres library SSL options
 * Based on Node.js TLS options
 */
interface SslConfig {
  ca?: string;
  rejectUnauthorized?: boolean;
  cert?: string;
  key?: string;
}

/**
 * PostgreSQL error shape from the postgres library
 */
interface PostgresLibraryError extends Error {
  code?: string;
  detail?: string;
  severity?: string;
  position?: string;
  schema?: string;
  table?: string;
  column?: string;
}

/**
 * Type guard to check if an error has PostgreSQL error properties
 */
function isPostgresLibraryError(error: unknown): error is PostgresLibraryError {
  return (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as PostgresLibraryError).message === "string"
  );
}

/**
 * Extract error details from an unknown error, handling both
 * PostgresError instances and raw PostgreSQL library errors
 */
function extractErrorDetails(error: unknown): {
  message: string;
  code?: string;
  detail?: string;
} {
  if (error instanceof PostgresError) {
    return {
      message: error.message,
      code: error.code,
      detail: error.detail,
    };
  }

  if (isPostgresLibraryError(error)) {
    return {
      message: error.message,
      code: error.code,
      detail: error.detail,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error occurred",
  };
}

export class DatabaseConnection {
  private sql: Sql;
  private isConnected: boolean = false;

  constructor(
    private readonly config: ServerConfig,
    private readonly logger: Logger
  ) {
    this.sql = this.createConnection();
  }

  /**
   * Create and configure PostgreSQL connection with SSL/TLS support
   *
   * Configures connection pooling, timeouts, prepared statements, and SSL
   * based on the server configuration.
   *
   * @returns Configured PostgreSQL connection instance
   */
  private createConnection(): Sql {
    const {
      databaseUrl,
      maxConnections,
      connectionTimeout,
      prepareStatements,
      debug,
      fetchTypes,
    } = this.config;

    // Build base connection options
    const connectionOptions: postgres.Options<
      Record<string, postgres.PostgresType>
    > = {
      max: maxConnections,
      idle_timeout: 20,
      connect_timeout: connectionTimeout,
      prepare: prepareStatements,
      onnotice: debug
        ? (notice) => this.logger.debug("PostgreSQL Notice", { notice })
        : undefined,
      transform: {
        undefined: null, // Transform undefined values to null for PostgreSQL compatibility
      },
      fetch_types: fetchTypes ?? true,
    };

    // Configure SSL/TLS based on configuration
    this.configureSsl(connectionOptions);

    // Log connection configuration
    this.logConnectionConfig(connectionOptions);

    return postgres(databaseUrl, connectionOptions);
  }

  /**
   * Configure SSL/TLS settings for the connection
   */
  private configureSsl(
    connectionOptions: postgres.Options<Record<string, postgres.PostgresType>>
  ): void {
    if (this.config.sslRootCertPath) {
      // Use custom CA certificate file
      try {
        const certificateAuthority = fs.readFileSync(
          this.config.sslRootCertPath,
          "utf-8"
        );
        const sslConfig: SslConfig = {
          ca: certificateAuthority,
          rejectUnauthorized: this.config.sslRejectUnauthorized ?? true,
        };
        connectionOptions.ssl = sslConfig;
        this.logger.debug("Using custom SSL root certificate", {
          path: this.config.sslRootCertPath,
          rejectUnauthorized: sslConfig.rejectUnauthorized,
        });
      } catch (error) {
        this.logger.error("Failed to read SSL root certificate", error);
        const { message } = extractErrorDetails(error);
        throw new PostgresError(
          `Failed to read SSL root certificate at ${this.config.sslRootCertPath}: ${message}`
        );
      }
    } else if (this.config.requireSsl) {
      // Enable SSL using system certificates (no custom CA)
      const sslConfig: SslConfig = {
        rejectUnauthorized: this.config.sslRejectUnauthorized ?? true,
      };
      connectionOptions.ssl = sslConfig;
      this.logger.debug("SSL enabled (using system certificates)", {
        rejectUnauthorized: sslConfig.rejectUnauthorized,
      });
    }
  }

  /**
   * Extract SSL configuration for logging purposes
   */
  private getSslConfigForLogging(
    ssl: postgres.Options<Record<string, postgres.PostgresType>>["ssl"]
  ): { rejectUnauthorized?: boolean } | undefined {
    if (
      typeof ssl === "object" &&
      ssl !== null &&
      !Array.isArray(ssl) &&
      "rejectUnauthorized" in ssl
    ) {
      const sslObj = ssl as SslConfig;
      return {
        rejectUnauthorized: sslObj.rejectUnauthorized,
      };
    }
    return undefined;
  }

  /**
   * Log connection configuration details
   */
  private logConnectionConfig(
    connectionOptions: postgres.Options<Record<string, postgres.PostgresType>>
  ): void {
    const sslLogging = this.getSslConfigForLogging(connectionOptions.ssl);
    this.logger.info("Creating PostgreSQL connection", {
      maxConnections: connectionOptions.max,
      prepareStatements: connectionOptions.prepare,
      tlsEnabled: Boolean(connectionOptions.ssl),
      sslRejectUnauthorized: sslLogging?.rejectUnauthorized,
      fetchTypes: connectionOptions.fetch_types,
    });
  }

  /**
   * Test database connection by executing a simple query
   */
  async testConnection(): Promise<void> {
    try {
      await this.sql`SELECT 1 as test`;
      this.isConnected = true;
      this.logger.info("Database connection established successfully");
    } catch (error) {
      this.isConnected = false;
      const { message, code, detail } = extractErrorDetails(error);
      throw new PostgresError(
        `Failed to connect to database: ${message}`,
        code,
        detail
      );
    }
  }

  /**
   * Execute a raw SQL query against the database
   *
   * @param query - The SQL query string to execute
   * @returns Array of result rows as records
   * @throws PostgresError if query execution fails
   */
  async executeQuery(query: string): Promise<Record<string, unknown>[]> {
    try {
      this.logger.debug("Executing query", {
        queryLength: query.length,
        preview: query.substring(0, 100),
      });

      const startTime = Date.now();
      const result = await this.sql.unsafe(query);
      const duration = Date.now() - startTime;

      this.logger.info("Query executed successfully", {
        rowCount: result.length,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error) {
      this.logger.error("Query execution failed", error);
      const { message, code, detail } = extractErrorDetails(error);
      throw new PostgresError(
        message || "Query execution failed",
        code,
        detail
      );
    }
  }

  /**
   * Get list of all user-defined tables in the database
   *
   * Excludes system schemas (pg_catalog, information_schema)
   * @returns Array of table information objects
   * @throws PostgresError if table retrieval fails
   */
  async getTables(): Promise<TableInfo[]> {
    try {
      const tables = await this.sql<TableInfo[]>`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name
      `;

      this.logger.debug("Retrieved table list", { count: tables.length });
      return tables;
    } catch (error) {
      this.logger.error("Failed to retrieve tables", error);
      const { code, detail } = extractErrorDetails(error);
      throw new PostgresError("Failed to retrieve table list", code, detail);
    }
  }

  /**
   * Get detailed schema information and sample rows for a specific table
   *
   * @param schema - The schema name containing the table
   * @param table - The table name
   * @returns Table resource with schema and sample rows (up to 50 rows)
   * @throws PostgresError if table is not found or retrieval fails
   */
  async getTableDetails(schema: string, table: string): Promise<TableResource> {
    // Validate inputs
    if (!schema || !table) {
      throw new PostgresError("Schema and table name are required");
    }

    try {
      // Retrieve column information from information_schema
      const columns = await this.sql<ColumnInfo[]>`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = ${schema}
          AND table_name = ${table}
        ORDER BY ordinal_position
      `;

      if (columns.length === 0) {
        throw new PostgresError(
          `Table ${schema}.${table} not found or no columns visible`
        );
      }

      // Retrieve sample rows using safely quoted identifiers
      const qualifiedTableName = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;
      const sampleRows = await this.sql.unsafe(
        `SELECT * FROM ${qualifiedTableName} LIMIT 50`
      );

      this.logger.debug("Retrieved table details", {
        schema,
        table,
        columnCount: columns.length,
        sampleRowCount: sampleRows.length,
      });

      return {
        schema: {
          schema,
          table,
          columns,
        },
        sampleRows,
      };
    } catch (error) {
      this.logger.error(`Failed to get details for ${schema}.${table}`, error);

      // Re-throw PostgresError instances as-is
      if (error instanceof PostgresError) {
        throw error;
      }

      // Wrap other errors in PostgresError with extracted details
      const { code, detail } = extractErrorDetails(error);
      throw new PostgresError(
        `Failed to retrieve details for table ${schema}.${table}`,
        code,
        detail
      );
    }
  }

  /**
   * Safely quote a PostgreSQL identifier to prevent SQL injection.
   *
   * Doubles any existing quotes and wraps the identifier in double quotes.
   * Validates that the identifier doesn't contain null bytes.
   *
   * @param identifier - The identifier to quote (e.g., schema or table name)
   * @returns The safely quoted identifier
   * @throws PostgresError if identifier contains null bytes
   */
  private quoteIdentifier(identifier: string): string {
    // Validate identifier doesn't contain null bytes (security check)
    if (identifier.includes("\0")) {
      throw new PostgresError("Identifier cannot contain null bytes");
    }

    // Double-quote and escape any quotes within the identifier
    // PostgreSQL requires doubling quotes: "schema" becomes ""schema""
    return '"' + identifier.replace(/"/g, '""') + '"';
  }

  /**
   * Close the database connection pool gracefully
   *
   * Waits up to 5 seconds for active connections to complete before closing.
   * Sets the connection status to disconnected.
   */
  async close(): Promise<void> {
    try {
      await this.sql.end({ timeout: 5 });
      this.isConnected = false;
      this.logger.info("Database connection closed");
    } catch (error) {
      this.logger.error("Error closing database connection", error);
      // Don't throw - connection closure errors shouldn't propagate
    }
  }

  /**
   * Get current connection status and pool size
   *
   * @returns Object containing connection status and configured pool size
   */
  getStatus(): { connected: boolean; poolSize: number } {
    return {
      connected: this.isConnected,
      poolSize: this.config.maxConnections,
    };
  }
}
