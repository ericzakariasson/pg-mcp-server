#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const { platform, arch } = process;
const { join } = require("node:path");
const { existsSync } = require("node:fs");

function resolveBinary() {
  const root = join(__dirname, "..", "dist");
  const map = new Map([
    ["darwin:arm64", "postgres-mcp-server-darwin-arm64"],
    ["darwin:x64", "postgres-mcp-server-darwin-x64"],
    ["linux:x64", "postgres-mcp-server-linux-x64"],
    ["linux:arm64", "postgres-mcp-server-linux-arm64"],
    ["win32:x64", "postgres-mcp-server-windows-x64.exe"],
  ]);

  const key = `${platform}:${arch}`;
  const file = map.get(key);
  // Prefer stable alias if present
  const stable = join(root, platform === "win32" ? "postgres-mcp-server.exe" : "postgres-mcp-server");
  if (existsSync(stable)) return stable;
  if (!file) return null;
  const full = join(root, file);
  return existsSync(full) ? full : null;
}

function main() {
  const bin = resolveBinary();
  if (!bin) {
    console.error(
      "Unsupported platform or missing binary. Please open an issue, or build locally with:\n" +
        "  bun build --compile --minify index.ts --outfile dist/postgres-mcp-server-<your-target>"
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const result = spawnSync(bin, args, { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

main();




