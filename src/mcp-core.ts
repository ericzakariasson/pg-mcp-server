import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig, validateConfig } from "./config.js";
import { DatabaseConnection } from "./database.js";
import { ConsoleLogger } from "./logger.js";
import { QueryValidator } from "./query-validator.js";
import type { QueryInput } from "./types.js";
import { QueryInputSchema } from "./types.js";

export interface PostgresMcpDeps {
  logger: ConsoleLogger;
  db: DatabaseConnection;
  queryValidator: QueryValidator;
}

export interface PostgresMcp {
  server: McpServer;
  ctx: PostgresMcpDeps;
}

/**
 * Create and configure the MCP server with all Postgres tools/resources.
 * Shared by both stdio and HTTP entrypoints.
 */
export function createPostgresMcpServer(): PostgresMcp {
  const config = loadConfig();
  validateConfig(config);

  const logger = new ConsoleLogger(config.debug);
  const db = new DatabaseConnection(config, logger);
  const queryValidator = new QueryValidator(config.allowWriteOps, logger);

  const server = new McpServer({
    name: "postgres-mcp-server",
    version: "0.1.0",
  });

  // Register query tool
  server.registerTool(
    "query",
    {
      title: "PostgreSQL Query",
      description:
        "Execute a SQL query against the configured PostgreSQL database. " +
        "Read-only by default; enable writes via DANGEROUSLY_ALLOW_WRITE_OPS environment variable.",
      inputSchema: { sql: QueryInputSchema.shape.sql },
    },
    async (args: unknown) => {
      try {
        const input = QueryInputSchema.parse(args) as QueryInput;
        queryValidator.validate(input.sql);
        const rows = await db.executeQuery(input.sql);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(rows, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error("Query tool error", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: errorMessage }, null, 2),
            },
          ],
        };
      }
    }
  );

  // Register tables resource
  server.registerResource(
    "tables",
    "postgres://tables",
    {
      title: "PostgreSQL Tables",
      description:
        "List all tables available in the connected PostgreSQL database.",
      mimeType: "application/json",
    },
    async (uri) => {
      try {
        const tables = await db.getTables();
        return {
          contents: [
            { uri: uri.href, text: JSON.stringify(tables, null, 2) },
          ],
        };
      } catch (error) {
        logger.error("Tables resource error", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to retrieve tables";
        return {
          contents: [
            { uri: uri.href, text: JSON.stringify({ error: errorMessage }, null, 2) },
          ],
        };
      }
    }
  );

  // Register table detail resource
  server.registerResource(
    "table",
    new ResourceTemplate("postgres://table/{schema}/{table}", { list: undefined }),
    {
      title: "PostgreSQL Table Details",
      description: "Get schema information and sample rows for a specific table",
      mimeType: "application/json",
    },
    async (uri, rawArgs) => {
      try {
        const schema = String(rawArgs?.schema ?? "");
        const table = String(rawArgs?.table ?? "");
        if (!schema || !table) {
          throw new Error("Schema and table parameters are required");
        }
        const tableDetails = await db.getTableDetails(schema, table);
        return {
          contents: [
            { uri: uri.href, text: JSON.stringify(tableDetails, null, 2) },
          ],
        };
      } catch (error) {
        logger.error("Table detail resource error", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to retrieve table details";
        return {
          contents: [
            { uri: uri.href, text: JSON.stringify({ error: errorMessage }, null, 2) },
          ],
        };
      }
    }
  );

  return { server, ctx: { logger, db, queryValidator } };
}




