#!/usr/bin/env node
/** Start Context Mode's direct MCP build in an isolated, deliberately minimal environment. */
import { mkdirSync } from "node:fs";
import { validateContextServer } from "./generalist-context.mjs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const at = args.indexOf("--server");
if (at < 0 || !args[at + 1] || args.length !== at + 2) {
  console.error("Usage: context-mode-server.mjs --server /absolute/path/to/build/server.js");
  process.exit(2);
}
const server = validateContextServer(args[at + 1]);
const base = resolve(process.env.PI_CONTEXT_MODE_HOME || resolve(homedir(), ".pi/context-mode-mcp"));
const home = resolve(base, "home");
for (const dir of [home, resolve(base, "config"), resolve(base, "cache"), resolve(base, "data"), resolve(base, "context-mode")]) mkdirSync(dir, { recursive: true, mode: 0o700 });
// Do not pass host/session variables: Context Mode's direct build probes metadata
// and has legacy cleanup/startup code.  Keep only executable/locale basics.
const env = {
  PATH: process.env.PATH || "/usr/bin:/bin",
  LANG: process.env.LANG || "C.UTF-8",
  HOME: home,
  XDG_CONFIG_HOME: resolve(base, "config"),
  XDG_CACHE_HOME: resolve(base, "cache"),
  XDG_DATA_HOME: resolve(base, "data"),
  CONTEXT_MODE_DIR: resolve(base, "context-mode"),
};
const child = spawn(process.execPath, [server], { stdio: "inherit", env });
child.on("exit", (code, signal) => process.exitCode = code ?? (signal ? 1 : 0));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
