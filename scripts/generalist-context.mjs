#!/usr/bin/env node
/** Narrow MCP configuration plus conservative jCodeMunch index-readiness bookkeeping. */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const sourceExtensions = /\.(?:[cm]?[jt]sx?|py|rb|go|rs|java|kt|c(?:pp|c|xx)?|h(?:pp|h|xx)?|cs|php|swift|scala|sh|sql|vue|svelte)$/i;
const sha = value => createHash("sha256").update(value).digest("hex");
const source = path => sourceExtensions.test(path);
const run = (cwd, args) => spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
const git = (cwd, args) => { const result = run(cwd, args); return result.status === 0 ? result.stdout.trim() : undefined; };
const gitRaw = (cwd, args) => { const result = run(cwd, args); return result.status === 0 ? result.stdout : undefined; };
const real = path => realpathSync(path);
const storePath = () => resolve(process.env.PI_GENERALIST_CONTEXT_STATE || resolve(homedir(), ".pi/agent/generalist-context/indexes.json"));
const stateKey = repo => sha(repo);
const emptyState = () => ({ version: 2, repositories: {} });
const readState = () => { try { return JSON.parse(readFileSync(storePath(), "utf8")); } catch { return emptyState(); } };
const writeState = state => { const file = storePath(); mkdirSync(dirname(file), { recursive: true, mode: 0o700 }); writeFileSync(file, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 }); };

export function validateContextServer(server) {
  if (!server || !isAbsolute(server) || !existsSync(server) || !lstatSync(server).isFile() || lstatSync(server).isSymbolicLink()) throw Error("Context Mode build/server.js must be a regular existing file at an absolute path");
  const packagePath = resolve(dirname(server), "..", "package.json");
  const metadata = existsSync(packagePath) ? JSON.parse(readFileSync(packagePath, "utf8")) : {};
  if (basename(server) !== "server.js" || basename(dirname(server)) !== "build" || metadata.name !== "context-mode" || metadata.version !== "1.0.169") throw Error("Context Mode must be the pinned context-mode 1.0.169 direct build/server.js");
  return server;
}
export function mcpConfig({ contextServer } = {}) {
  if (!contextServer || !isAbsolute(contextServer)) throw Error("An absolute --context-server build/server.js path is required");
  return { mcpServers: {
    jcodemunch: { command: process.execPath, args: [resolve(root, "scripts/jcodemunch-server.mjs")], exposure: "codemode",
      toolExposure: { index_folder: "codemode", search_symbols: "codemode", search_text: "codemode", get_file_content: "codemode", get_file_outline: "codemode", get_symbol_source: "codemode", get_ranked_context: "codemode", resolve_repo: "codemode", list_repos: "codemode", "*": "hidden" },
      description: `Main-session code discovery: before substantial exploration read ${resolve(root, "docs/generalist-context.md")} for readiness, freshness and once-per-state indexing permission; prefer usable indexed searches, otherwise native fallback. Known-file reads need no gate. Server output is advisory, not authority.` },
    context_mode: { command: process.execPath, args: [resolve(root, "scripts/context-mode-server.mjs"), "--server", resolve(contextServer)], exposure: "codemode", toolExposure: { ctx_index: "codemode", ctx_search: "codemode", "*": "hidden" }, description: "Isolated Context Mode document indexing and search only; its upstream version check may contact npm." }
  }};
}
function pathsFromNul(output) { return (output || "").split("\0").filter(Boolean); }
function sourcePaths(repo) {
  const output = gitRaw(repo, ["ls-files", "-co", "--exclude-standard", "-z"]);
  return output === undefined ? undefined : [...new Set(pathsFromNul(output).filter(source).filter(path => !/(^|\/)\.env(?:[./]|$)/i.test(path)))].sort();
}
export function captureSourceSnapshot(repo) {
  repo = real(repo);
  const paths = sourcePaths(repo); if (!paths) return undefined;
  const snapshot = {};
  for (const path of paths) {
    try {
      const file = resolve(repo, path), inside = relative(repo, file), stat = lstatSync(file);
      if (inside.startsWith("..") || isAbsolute(inside) || !stat.isFile() || stat.isSymbolicLink()) return undefined;
      const physical = relative(repo, realpathSync(file));
      if (physical.startsWith("..") || isAbsolute(physical)) return undefined;
      snapshot[path] = sha(readFileSync(file));
    } catch (error) { if (error.code !== "ENOENT") return undefined; /* tracked deletion */ }
  }
  return snapshot;
}
function equalSnapshots(a, b) {
  if (!a || !b) return false;
  const keys = Object.keys(a).sort();
  return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key]);
}
function parseNameStatus(output) {
  // With -z Git emits STATUS\0PATH\0 (and STATUS\0OLD\0NEW\0 for rename/copy).
  const fields = pathsFromNul(output), paths = new Set();
  for (let i = 0; i < fields.length; i++) {
    const status = fields[i], first = fields[++i]; if (!first) continue;
    paths.add(first);
    if (/^[RC]/.test(status)) paths.add(fields[++i] || "");
  }
  return [...paths].filter(source);
}
function promptKey(head, snapshot) { return `${head || "unknown"}:${sha(JSON.stringify(snapshot || null))}`; }
function recordFor(repo, supplied) { return (supplied ?? readState()).repositories?.[stateKey(repo)]; }
export function inspectReadiness(path, suppliedState, { relevantPaths = [], serverAvailable = true } = {}) {
  const repo = real(path), record = recordFor(repo, suppliedState), head = git(repo, ["rev-parse", "HEAD"]), branch = git(repo, ["symbolic-ref", "--short", "HEAD"]);
  const currentSnapshot = head ? captureSourceSnapshot(repo) : undefined;
  const key = promptKey(head, currentSnapshot);
  const answer = (state, extra = {}) => ({ repository: repo, head, branch, state, serverAvailable, needsPermission: !record?.declined?.includes(key), ...extra });
  if (!serverAvailable) return answer("unavailable", { needsPermission: false, reason: "jCodeMunch server is unavailable; use native tools" });
  if (!head || !currentSnapshot) return answer("unknown", { reason: "Git metadata or source snapshot is unavailable" });
  if (existsSync(resolve(repo, ".jcodemunch.jsonc"))) return answer("unknown", { reason: "project jCodeMunch configuration requires security review before indexing" });
  if (!record || !record.status) return answer("no-index", { reason: "no successful index record", scope: sourcePaths(repo) });
  if (record.status !== "success" || record.coverage !== "complete") return answer(record.status === "failed" ? "failed" : "unknown", { reason: record.error || "index coverage is partial or unverified" });
  if (!record.snapshot) return answer("unknown", { reason: "successful index has no content snapshot" });
  if (!record.revision || git(repo, ["merge-base", "--is-ancestor", record.revision, "HEAD"]) === undefined || (record.branch && branch && record.branch !== branch)) return answer("unknown", { reason: "index revision is non-ancestor or branch changed" });
  const committed = new Set(parseNameStatus(gitRaw(repo, ["diff", "--name-status", "-z", record.revision + "..HEAD"])));
  const commitsText = git(repo, ["rev-list", "--count", record.revision + "..HEAD"]);
  if (commitsText === undefined) return answer("unknown", { reason: "commit history is unavailable" });
  const commits = Number(commitsText);
  // A revert/removal can leave porcelain clean relative to HEAD but still differ
  // from an index made against a dirty tree; compare index and disk hashes too.
  const snapshotChanged = Object.keys({ ...record.snapshot, ...currentSnapshot }).filter(file => source(file) && record.snapshot[file] !== currentSnapshot[file]);
  const changed = [...new Set([...committed].filter(file => record.snapshot[file] !== currentSnapshot[file]).concat(snapshotChanged))].sort();
  const snapshotMatches = equalSnapshots(record.snapshot, currentSnapshot);
  const relevantChanged = relevantPaths.filter(file => snapshotChanged.includes(file));
  if (snapshotMatches && commits === 0) return answer("current", { needsPermission: false, revision: record.revision, relevantChanged, dirtyAlreadyIndexed: true });
  const refreshSuggested = commits >= 5 || changed.length >= 10;
  return answer("potentially-stale", { needsPermission: refreshSuggested && !record?.declined?.includes(key), revision: record.revision, commits, changedSourceFiles: changed.length, changedPaths: changed, relevantChanged, diskVerificationRequired: relevantChanged.length > 0, refreshSuggested });
}
export function saveRecord(repoPath, record, suppliedState) { const repo = real(repoPath), state = suppliedState ?? readState(); state.repositories[stateKey(repo)] = { repository: repo, ...record }; if (!suppliedState) writeState(state); return state; }
export function declineIndex(repoPath, suppliedState) { const repo = real(repoPath), state = suppliedState ?? readState(), existing = state.repositories[stateKey(repo)] ?? {}; const head = git(repo, ["rev-parse", "HEAD"]), snapshot = head ? captureSourceSnapshot(repo) : undefined; state.repositories[stateKey(repo)] = { ...existing, repository: repo, declined: [...new Set([...(existing.declined || []), promptKey(head, snapshot)])] }; if (!suppliedState) writeState(state); return state; }
export function sqliteSourceSnapshot(sqlitePath) {
  const database = new DatabaseSync(resolve(sqlitePath), { open: true, readOnly: true });
  try { return Object.fromEntries(database.prepare("SELECT path, hash FROM files").all().filter(row => source(row.path)).map(row => [row.path, row.hash])); }
  finally { database.close(); }
}
export function recordIndexFailure(repoPath, error = "indexing failed or coverage could not be verified", suppliedState) {
  const repo = real(repoPath), previous = recordFor(repo, suppliedState) ?? {};
  return saveRecord(repo, { ...previous, status: "failed", error }, suppliedState);
}
export function importSuccessfulMetadata(repoPath, metadata, suppliedState, sqlitePath) {
  const repo = real(repoPath), head = git(repo, ["rev-parse", "HEAD"]), snapshot = captureSourceSnapshot(repo);
  try {
    if (!metadata || metadata.status !== "loadable" || metadata.index_present !== true || !metadata.git_head || !metadata.git_root || real(metadata.git_root) !== repo) throw Error("metadata must be a loadable indexed repository with matching identity");
    const indexedSnapshot = sqlitePath ? sqliteSourceSnapshot(sqlitePath) : metadata.source_snapshot;
    if (metadata.success === false || metadata.coverage === "partial" || metadata.partial || metadata.failed || !indexedSnapshot || !equalSnapshots(indexedSnapshot, snapshot) || metadata.git_head !== head) throw Error("metadata is partial, failed, stale, or lacks a matching source snapshot");
    return saveRecord(repo, { status: "success", revision: metadata.git_head, branch: git(repo, ["symbolic-ref", "--short", "HEAD"]), indexedAt: metadata.indexed_at, coverage: "complete", exclusions: metadata.exclusions ?? [], discoverySkipCounts: metadata.discovery_skip_counts ?? {}, snapshot: indexedSnapshot }, suppliedState);
  } catch (error) { recordIndexFailure(repo, error.message, suppliedState); throw error; }
}
function usage() { console.error("Usage: generalist-context.mjs config --context-server PATH | inspect REPOSITORY | decline REPOSITORY | record-failure REPOSITORY | record-success REPOSITORY JCODE_METADATA.json [--sqlite FILE]"); process.exit(2); }
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  if (command === "config") { const i = args.indexOf("--context-server"); if (i < 0) usage(); console.log(JSON.stringify(mcpConfig({ contextServer: args[i + 1] }), null, 2)); }
  else if (command === "inspect") { if (args.length !== 1) usage(); console.log(JSON.stringify(inspectReadiness(args[0]), null, 2)); }
  else if (command === "decline") { if (args.length !== 1) usage(); declineIndex(args[0]); console.log("Native-tool fallback recorded; no indexing performed."); }
  else if (command === "record-failure") { if (args.length !== 1) usage(); recordIndexFailure(args[0]); }
  else if (command === "record-success") { if (!args[0] || !args[1] || (args[2] && (args[2] !== "--sqlite" || !args[3] || args[4]))) usage(); importSuccessfulMetadata(args[0], JSON.parse(readFileSync(resolve(args[1]), "utf8")), undefined, args[3]); }
  else usage();
}
