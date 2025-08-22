# PostgreSQL MCP Server

A Model Context Protocol server for PostgreSQL databases. Enables LLMs to query and analyze PostgreSQL databases through a controlled interface.

## Installation

Add to your MCP client settings:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "bun",
      "args": ["run", "/path/to/postgres-mcp-server/index.ts", "--transport", "stdio"],
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
# stdio transport (default)
bun run index.ts --transport=stdio

# http transport
bun run index.ts --transport=http
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
git clone https://github.com/ericzakariasson/postgres-mcp-server.git
cd postgres-mcp-server
bun install

# Run (stdio transport)
bun run index.ts -- --transport=stdio
DEBUG=true bun run index.ts -- --transport=stdio

# Run (http transport)
bun run index.ts -- --transport=http
DEBUG=true bun run index.ts -- --transport=http
bun test                      # Run tests
```

### Building Standalone Binary

```bash
# Build for current platform
bun build:current

# Run the binary directly
./dist/postgres-mcp-server --transport=stdio

# Build for all platforms (for publishing)
bun build:bin
```

The standalone binary includes the Bun runtime and all dependencies - no Node.js or Bun required on target machines.

## License

MIT - see [LICENSE](LICENSE)