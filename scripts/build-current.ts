#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, copyFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const { platform, arch, env, exit } = process;

const outDir = join(import.meta.dir, "..", "dist");
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

const baseName = "postgres-mcp-server";

function resolveTarget(p: NodeJS.Platform, a: string) {
  if (p === "darwin" && a === "arm64") return { target: null as string | null, outfile: `${baseName}-darwin-arm64` };
  if (p === "darwin" && a === "x64") return { target: "bun-darwin-x64", outfile: `${baseName}-darwin-x64` };
  if (p === "linux" && a === "x64") return { target: "bun-linux-x64", outfile: `${baseName}-linux-x64` };
  if (p === "linux" && a === "arm64") return { target: "bun-linux-arm64", outfile: `${baseName}-linux-arm64` };
  if (p === "win32" && a === "x64") return { target: "bun-windows-x64", outfile: `${baseName}-windows-x64.exe` };
  return null;
}

const mapping = resolveTarget(platform, arch);
if (!mapping) {
  console.error(`Unsupported platform/arch: ${platform}/${arch}`);
  exit(1);
}

const outfilePath = join(outDir, mapping.outfile);
const args = [
  "build",
  "--compile",
  "--minify",
  // optional target (not needed for darwin arm64)
  ...(mapping.target ? [`--target=${mapping.target}`] : []),
  "index.ts",
  "--outfile",
  outfilePath,
];

console.error(`Building ${outfilePath} for ${platform}/${arch}${mapping.target ? ` (${mapping.target})` : ""}...`);
const res = spawnSync("bun", args, { stdio: "inherit", env });
if ((res.status ?? 1) !== 0) exit(res.status ?? 1);

// Create/overwrite a stable alias without platform suffix for convenience
const stableName = platform === "win32" ? `${baseName}.exe` : baseName;
const stablePath = join(outDir, stableName);
try {
  copyFileSync(outfilePath, stablePath);
  console.error(`Created stable alias: ${stablePath}`);
} catch (e) {
  console.error(`Failed to create stable alias at ${stablePath}:`, e);
  exit(1);
}

// Cleanup stray Bun build temp files created in project root, e.g. .<hash>-00000000.bun-build
try {
  const root = join(import.meta.dir, "..");
  for (const name of readdirSync(root)) {
    if (name.startsWith(".") && name.endsWith(".bun-build")) {
      try {
        unlinkSync(join(root, name));
      } catch {}
    }
  }
} catch {}

exit(0);


