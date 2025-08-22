# Changelog

## [0.1.0] - 2025-08-22

### Added
- PostgreSQL MCP Server implementation with Model Context Protocol support
- Dual transports: stdio (default) and Streamable HTTP at `/mcp` (configurable `PORT`, default `3000`)
- SQL `query` tool returning JSON-encoded rows with security validation
- Resources:
  - `postgres://tables` to list user tables (excludes `pg_catalog` and `information_schema`)
  - `postgres://table/{schema}/{table}` to return table schema and up to 50 sample rows (safe identifier quoting)
- Connection pooling and DB client settings (prepared statements, connection and statement timeouts)
- Robust configuration with Zod validation and sensible defaults:
  - `DATABASE_URL` (required)
  - `DANGEROUSLY_ALLOW_WRITE_OPS` (default: false)
  - `PG_MAX_CONNECTIONS` (default: 10)
  - `PG_CONNECTION_TIMEOUT` (seconds, default: 30)
  - `PG_STATEMENT_TIMEOUT` (ms, default: 30000)
  - `PG_PREPARE_STATEMENTS` (default: true)
  - `DEBUG` (default: false)
  - `PORT` for HTTP transport (default: 3000)
- Query validation and safety features:
  - Enforces read-only by default; denies writes unless explicitly enabled
  - Detects write operations (insert/update/delete/truncate/drop/alter/create/grant/revoke/import/copy/merge/upsert/replace)
  - Multi-statement parsing with string/comment awareness; basic SQL injection pattern warnings
  - Safe keyword allowlist (e.g., select/with/show/explain/values/table/describe/desc)
- Console logger with levels; logs to stderr to avoid corrupting stdio JSON-RPC
- Graceful shutdown handling (SIGINT/SIGTERM) for both stdio and HTTP transports
- Docker Compose for local Postgres with sample data and scripts:
  - `bun run db:start`, `db:stop`, `db:reset`
  - Init script `init-scripts/01-init-sample-data.sql` (tables: users, products, orders, order_items)
- Developer tooling scripts: `inspector:stdio`, `inspector:http`, `typecheck`, `lint`, `test`, `format`
- Strongly-typed APIs and error classes (`PostgresError`, `ConfigurationError`, `QueryValidationError`)
- Comprehensive test suite