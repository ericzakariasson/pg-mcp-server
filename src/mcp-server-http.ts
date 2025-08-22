import http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ConfigurationError } from "./types.js";
import { createPostgresMcpServer } from "./mcp-core.js";

export async function startMcpServerHttp(): Promise<void> {
  const { server: mcpServer, ctx } = createPostgresMcpServer();

  try {
    await ctx.db.testConnection();

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);

    const nodeServer = http.createServer(async (req, res) => {
      if (!req.url) {
        res.statusCode = 400;
        res.end("Bad Request");
        return;
      }
      if (req.method === "POST" && req.url.startsWith("/mcp")) {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c as Buffer));
        req.on("end", async () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed: unknown = undefined;
          try {
            parsed = raw ? JSON.parse(raw) : undefined;
          } catch {
            // ignore parse error; transport validates
          }
          await transport.handleRequest(req, res, parsed);
        });
        return;
      }
      if ((req.method === "GET" || req.method === "DELETE") && req.url.startsWith("/mcp")) {
        await transport.handleRequest(req, res);
        return;
      }
      res.statusCode = 404;
      res.end("Not Found");
    });

    const port = Number(process.env.PORT ?? 3000);
    nodeServer.listen(port, () => {
      ctx.logger.info(`PostgreSQL MCP HTTP Server listening on http://localhost:${port}/mcp`);
    });

    const shutdown = async (signal: string) => {
      ctx.logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        nodeServer.close();
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
  } catch (error) {
    ctx.logger.error("Failed to start http server", error);
    if (error instanceof ConfigurationError) {
      console.error(`Configuration Error: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServerHttp().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}




