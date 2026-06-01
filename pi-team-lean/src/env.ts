/**
 * env.ts — build an explicit allow-listed environment for child processes that
 * run untrusted or semi-trusted commands (the verify test command and the
 * qa-author acceptance script).
 *
 * Previously `runTestCommand` and the acceptance exec inherited the operator's
 * full `process.env`, handing every secret (GITHUB_TOKEN, ANTHROPIC_API_KEY,
 * cloud creds, …) to an LLM-authored bash script — the exfiltration half of
 * `qa-script-arbitrary-exec`. This module hands those children only what a build
 * legitimately needs: PATH, locale, HOME/TMP, and a small toolchain-config
 * allow-list. Nothing whose name looks secret-bearing is ever forwarded.
 */

/**
 * Exact env var names that are always safe and commonly required for a build /
 * test command to find its toolchain.
 */
const BASE_ALLOW = new Set<string>([
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "TMPDIR",
  "TZ",
  "PWD",
  // Node / common JS toolchain
  "NODE_ENV",
  "NODE_OPTIONS",
  "NPM_CONFIG_CACHE",
  "NVM_DIR",
  "NVM_BIN",
  "FNM_DIR",
  "COREPACK_HOME",
  // Other common language toolchains (paths, not creds)
  "CARGO_HOME",
  "RUSTUP_HOME",
  "GOPATH",
  "GOCACHE",
  "GOMODCACHE",
  "PYENV_ROOT",
  "JAVA_HOME",
  "CI",
]);

/**
 * Name fragments that mark a variable as secret-bearing. Anything matching is
 * dropped even if it would otherwise be allow-listed by prefix.
 */
const SECRET_FRAGMENTS = [
  "TOKEN",
  "SECRET",
  "PASSWORD",
  "PASSWD",
  "API_KEY",
  "APIKEY",
  "ACCESS_KEY",
  "PRIVATE",
  "CREDENTIAL",
  "AUTH",
  "SESSION",
  "COOKIE",
  "KEY", // broad on purpose; toolchain *_DIR/HOME paths above are exact-allow-listed
];

const looksSecret = (name: string): boolean => {
  const upper = name.toUpperCase();
  return SECRET_FRAGMENTS.some((frag) => upper.includes(frag));
};

/**
 * Produce an allow-listed env from `source` (defaults to `process.env`). Only
 * exact-allow-listed names survive, and any that look secret-bearing are
 * dropped regardless. Always provides a sane PATH so commands resolve.
 */
export const allowListedEnv = (source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => {
  const out: NodeJS.ProcessEnv = {};
  for (const name of BASE_ALLOW) {
    const v = source[name];
    if (v !== undefined && !looksSecret(name)) out[name] = v;
  }
  if (!out.PATH) out.PATH = "/usr/local/bin:/usr/bin:/bin";
  return out;
};
