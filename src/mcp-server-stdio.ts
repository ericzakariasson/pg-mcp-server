import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConfigurationError } from "./types.js";
import { createPostgresMcpServer } from "./mcp-core.js";

export async function startMcpServerStdio(): Promise<void> {
  const { server, ctx } = createPostgresMcpServer("stdio");

  try {
    await ctx.db.testConnection();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      ctx.logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await ctx.db.close();
        ctx.logger.info("Shutdown complete");
        process.exit(0);
      } catch (error) {
        ctx.logger.error("Error during shutdown", error);
        process.exit(1);
      }
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    const transport = new StdioServerTransport();
    await server.connect(transport);

    ctx.logger.info("PostgreSQL MCP Server (stdio) started successfully");
  } catch (error) {
    ctx.logger.error("Failed to start stdio server", error);
    if (error instanceof ConfigurationError) {
      console.error(`Configuration Error: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}




