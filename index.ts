#!/usr/bin/env bun

/**
 * PostgreSQL MCP Server
 *
 * A Model Context Protocol server that provides tools and resources
 * for interacting with PostgreSQL databases.
 *
 * Environment Variables:
 * - DATABASE_URL: PostgreSQL connection string (required)
 * - DANGEROUSLY_ALLOW_WRITE_OPS: Enable write operations (default: false)
 * - PG_MAX_CONNECTIONS: Maximum number of connections (default: 10)
 * - PG_CONNECTION_TIMEOUT: Connection timeout in seconds (default: 30)
 * - PG_STATEMENT_TIMEOUT: Statement timeout in milliseconds (default: 30000)
 * - PG_PREPARE_STATEMENTS: Enable prepared statements (default: true)
 * - DEBUG: Enable debug logging (default: false)
 */

import { parseArgs } from "util";
import { z } from "zod";

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    transport: { type: "string" },
  },
  strict: true,
  allowPositionals: true,
});

const ArgSchema = z.object({
  transport: z.enum(["stdio", "http"]).default("stdio"),
});

const { transport } = ArgSchema.parse({ transport: values.transport });

async function startSelectedTransport() {
  switch (transport) {
    case "http": {
      const { startMcpServerHttp } = await import("./src/mcp-server-http.js");
      return startMcpServerHttp();
    }
    case "stdio":
    default: {
      const { startMcpServerStdio } = await import("./src/mcp-server-stdio.js");
      return startMcpServerStdio();
    }
  }
}

startSelectedTransport().catch((error) => {
  console.error("Failed to start PostgreSQL MCP Server:", error);
  process.exit(1);
});
