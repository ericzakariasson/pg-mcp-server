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

export class DatabaseConnection {
  private sql: Sql;
  private isConnected: boolean = false;

  constructor(
    private readonly config: ServerConfig,
    private readonly logger: Logger,
  ) {
    this.sql = this.createConnection();
  }

  /**
   * Create postgres connection with configuration
   */
  private createConnection(): Sql {
    const connectionOptions: postgres.Options<Record<string, postgres.PostgresType>> = {
      max: this.config.maxConnections,
      idle_timeout: 20,
      connect_timeout: this.config.connectionTimeout,
      prepare: this.config.prepareStatements,
      onnotice: this.config.debug
        ? (notice) => this.logger.debug("PostgreSQL Notice", { notice })
        : undefined,
      transform: {
        undefined: null, // Transform undefined to null
      },
    };

    // Enable TLS with custom CA if provided
    if (this.config.sslRootCertPath) {
      try {
        const ca = fs.readFileSync(this.config.sslRootCertPath).toString();
        connectionOptions.ssl = {
          ca,
          rejectUnauthorized: true,
        };
      } catch (error) {
        this.logger.error("Failed to read SSL root certificate", error);
        throw new PostgresError(
          `Failed to read SSL root certificate at ${this.config.sslRootCertPath}`,
        );
      }
    }

    this.logger.info("Creating PostgreSQL connection", {
      maxConnections: connectionOptions.max,
      prepareStatements: connectionOptions.prepare,
      tlsEnabled: Boolean(connectionOptions.ssl),
    });

    return postgres(this.config.databaseUrl, connectionOptions);
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<void> {
    try {
      await this.sql`SELECT 1 as test`;
      this.isConnected = true;
      this.logger.info("Database connection established successfully");
    } catch (error) {
      this.isConnected = false;
      throw new PostgresError(
        "Failed to connect to database",
        (error as any)?.code,
        (error as any)?.message,
      );
    }
  }

  /**
   * Execute a raw SQL query
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
    } catch (error: any) {
      this.logger.error("Query execution failed", error);
      throw new PostgresError(
        error.message || "Query execution failed",
        error.code,
        error.detail,
      );
    }
  }

  /**
   * Get list of all tables in the database
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
    } catch (error: any) {
      this.logger.error("Failed to retrieve tables", error);
      throw new PostgresError(
        "Failed to retrieve table list",
        error.code,
        error.detail,
      );
    }
  }

  /**
   * Get table schema and sample data
   */
  async getTableDetails(schema: string, table: string): Promise<TableResource> {
    try {
      // Validate inputs
      if (!schema || !table) {
        throw new PostgresError("Schema and table name are required");
      }

      // Get column information
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
          `Table ${schema}.${table} not found or no columns visible`,
        );
      }

      // Get sample rows with safe identifier quoting
      const qualified = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;
      const sampleRows = await this.sql.unsafe(
        `SELECT * FROM ${qualified} LIMIT 50`,
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
    } catch (error: any) {
      this.logger.error(`Failed to get details for ${schema}.${table}`, error);

      if (error instanceof PostgresError) {
        throw error;
      }

      throw new PostgresError(
        `Failed to retrieve details for table ${schema}.${table}`,
        error.code,
        error.detail,
      );
    }
  }

  /**
   * Safely quote a PostgreSQL identifier
   */
  private quoteIdentifier(identifier: string): string {
    // Validate identifier doesn't contain null bytes
    if (identifier.includes("\0")) {
      throw new PostgresError("Identifier cannot contain null bytes");
    }

    // Double-quote and escape any quotes within
    return '"' + identifier.replace(/"/g, '""') + '"';
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    try {
      await this.sql.end({ timeout: 5 });
      this.isConnected = false;
      this.logger.info("Database connection closed");
    } catch (error) {
      this.logger.error("Error closing database connection", error);
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; poolSize: number } {
    return {
      connected: this.isConnected,
      poolSize: this.config.maxConnections,
    };
  }
}
