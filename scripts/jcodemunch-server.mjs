#!/usr/bin/env node
/** Launch the pinned jCodeMunch server without inheriting host configuration/session state. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const base = resolve(process.env.PI_JCODEMUNCH_HOME || resolve(homedir(), ".pi/jcodemunch-mcp"));
const home = resolve(base, "home");
for (const dir of [home, resolve(base, "config"), resolve(base, "cache"), resolve(base, "data")]) mkdirSync(dir, { recursive: true, mode: 0o700 });
const cache = resolve(process.env.PI_JCODEMUNCH_UV_CACHE || resolve(homedir(), ".cache/uv"));
const indexPath = resolve(base, "data/code-index");
mkdirSync(indexPath, { recursive: true, mode: 0o700 });
// The pinned server treats env values only as fallbacks. Keep explicit privacy
// values in its dedicated global config, not in any project policy file.
const privacy = { use_ai_summaries: false, share_savings: false, allow_remote_summarizer: false, allow_paid_summaries: false, perf_telemetry_enabled: false, watch: false };
const configPath = resolve(indexPath, "config.jsonc");
if (existsSync(configPath)) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (Object.entries(privacy).some(([key, value]) => config[key] !== value)) throw Error("Dedicated jCodeMunch config conflicts with trial privacy settings; refusing startup");
} else writeFileSync(configPath, JSON.stringify({ version: "1.108.359", ...privacy, tool_surface: "full" }, null, 2) + "\n", { mode: 0o600 });
const env = {
  PATH: process.env.PATH || "/usr/bin:/bin",
  LANG: process.env.LANG || "C.UTF-8",
  HOME: home, XDG_CONFIG_HOME: resolve(base, "config"), XDG_CACHE_HOME: resolve(base, "cache"), XDG_DATA_HOME: resolve(base, "data"),
  UV_CACHE_DIR: cache, CODE_INDEX_PATH: indexPath,
  JCODEMUNCH_USE_AI_SUMMARIES: "false", JCODEMUNCH_SHARE_SAVINGS: "false",
  JCODEMUNCH_ALLOW_REMOTE_SUMMARIZER: "false", JCODEMUNCH_ALLOW_PAID_SUMMARIES: "false",
  JCODEMUNCH_PERF_TELEMETRY: "false", JCODEMUNCH_TOOL_SURFACE: "full",
};
const child = spawn("uvx", ["--from", "jcodemunch-mcp==1.108.359", "jcodemunch-mcp", "serve", "--transport", "stdio", "--watcher=false"], { stdio: "inherit", env });
child.on("exit", (code, signal) => process.exitCode = code ?? (signal ? 1 : 0));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
