# Postgres MCP Server

A Model Context Protocol server for PostgreSQL databases. Enables LLMs to query and analyze PostgreSQL databases through a controlled interface.

## Installation

Add to your MCP client settings:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["--yes", "pg-mcp-server", "--transport", "stdio"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/postgres"
      }
    }
  }
}
```

## Configuration

- `DATABASE_URL` - PostgreSQL connection string (required)
- `DANGEROUSLY_ALLOW_WRITE_OPS` - Enable writes (default: `false`)
- `DEBUG` - Enable debug logging (default: `false`)

## Usage

### Transports

- Default transport is **stdio**. Switch to **HTTP** with the `--transport` flag.
- HTTP mode serves the MCP Streamable HTTP endpoint at `/mcp` on `PORT` (default `3000`).
- Clients that support Streamable HTTP should connect to `http://localhost:3000/mcp`.

Start commands:

```bash
# stdio transport (default, via installed CLI)
pg-mcp-server --transport=stdio

# http transport
pg-mcp-server --transport=http
```

### Tools

- **`query`** - Execute SQL queries
  ```json
  { "sql": "SELECT * FROM users WHERE active = true LIMIT 10" }
  ```

### Resources

- **`postgres://tables`** - List all tables
- **`postgres://table/{schema}/{table}`** - Get table schema and sample data

### Example Prompts

Here's an example prompt to test if your MCP server is working:

```
Show me the first 5 users from the database
```

## Quick Start with Docker

```bash
# Start PostgreSQL with sample data
bun run db:start

# Test with MCP Inspector
bun run inspector

# Stop PostgreSQL
bun run db:stop
```

Sample tables included: `users`, `products`, `orders`, `order_items`

## Development

```bash
# Clone and install
git clone https://github.com/ericzakariasson/pg-mcp-server.git
cd pg-mcp-server
bun install

# Run (stdio transport)
bun run index.ts -- --transport=stdio
DEBUG=true bun run index.ts -- --transport=stdio

# Run (http transport)
bun run index.ts -- --transport=http
DEBUG=true bun run index.ts -- --transport=http
bun test                      # Run tests
```

Use local build in MCP client settings:

```bash
bun run build:js
```

```json
{
  "mcpServers": {
    "postgres": {
      "command": "node",
      "args": ["/absolute/path/to/pg-mcp-server/lib/index.js", "--transport", "stdio"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/postgres"
      }
    }
  }
}
```

## License

MIT - see [LICENSE](LICENSE)