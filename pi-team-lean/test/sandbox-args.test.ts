import { describe, it, expect } from "vitest";
import {
  buildSandboxPodmanArgs,
  isSandboxLaunchFailureExit,
  SandboxLaunchError,
  SANDBOX_LAUNCH_EXIT_CODES,
  sandboxParentEnv,
  PODMAN_SOCKET_ENV_VARS,
} from "../src/pi.js";

const baseEnv = {
  PI_SANDBOX: "1",
  PI_SANDBOX_IMAGE: "localhost/dua-factory-foreman:latest",
  PI_SANDBOX_NETWORK: "pi-sandbox-net",
  PI_SANDBOX_PROXY: "http://egress-proxy:8888",
  PI_WORKER_HOME: "/home/factory/.factory-worker-home",
  PI_SKILLS_DIR: "/app/vendor/pi-toolkit/pi-roles",
} as NodeJS.ProcessEnv;

const CWD = "/home/factory/repos/.factory-worktrees/acme/run-42";
const PI_ARGS = ["-p", "--no-session", "--mode", "text", "--model", "openai-codex/gpt-5.5"];

describe("buildSandboxPodmanArgs (ADR 0011 worker sandbox argv)", () => {
  const argv = buildSandboxPodmanArgs({ cwd: CWD, piArgs: PI_ARGS, env: baseEnv });
  const joined = argv.join(" ");

  it("is a `podman run --rm -i` invocation", () => {
    expect(argv[0]).toBe("run");
    expect(argv).toContain("--rm");
    expect(argv).toContain("-i"); // stdin stays open for the prompt
  });

  it("attaches the worker to the internal sandbox network", () => {
    const i = argv.indexOf("--network");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(argv[i + 1]).toBe("pi-sandbox-net");
  });

  it("mounts the worktree READ-WRITE at the same host==container path", () => {
    expect(argv).toContain(`${CWD}:${CWD}:rw`);
    // -w sets the workdir to the worktree
    const w = argv.indexOf("-w");
    expect(argv[w + 1]).toBe(CWD);
  });

  it("mounts PI_WORKER_HOME READ-ONLY (worker can't corrupt the subscription)", () => {
    expect(argv).toContain(
      "/home/factory/.factory-worker-home:/home/factory/.factory-worker-home:ro",
    );
    // and never read-write
    expect(joined).not.toContain("/home/factory/.factory-worker-home:/home/factory/.factory-worker-home:rw");
  });

  it("points the worker at the egress proxy with NO_PROXY empty", () => {
    expect(argv).toContain("HTTPS_PROXY=http://egress-proxy:8888");
    expect(argv).toContain("HTTP_PROXY=http://egress-proxy:8888");
    expect(argv).toContain("NO_PROXY=");
  });

  it("sets HOME to the worker home and forwards PI_SKILLS_DIR", () => {
    expect(argv).toContain("HOME=/home/factory/.factory-worker-home");
    expect(argv).toContain("PI_SKILLS_DIR=/app/vendor/pi-toolkit/pi-roles");
  });

  it("runs the configured image and ends with `pi <args>`", () => {
    const imgIdx = argv.indexOf("localhost/dua-factory-foreman:latest");
    expect(imgIdx).toBeGreaterThanOrEqual(0);
    expect(argv[imgIdx + 1]).toBe("pi");
    expect(argv.slice(imgIdx + 2)).toEqual(PI_ARGS);
  });

  it("GRANTS NONE of the forbidden authority (security boundary)", () => {
    expect(joined).not.toContain("podman.sock");
    expect(joined).not.toContain("/etc/factory");
    expect(joined).not.toContain(".ssh");
    expect(joined.toUpperCase()).not.toContain("TOKEN");
    expect(joined).not.toContain("--privileged");
    expect(joined).not.toContain("DOCKER_HOST");
    expect(joined).not.toContain("CONTAINER_HOST");
    // no second worktree / sibling mount: exactly one rw bind, and it is the cwd
    const rwMounts = argv.filter((a) => a.endsWith(":rw"));
    expect(rwMounts).toEqual([`${CWD}:${CWD}:rw`]);
  });

  it("falls back to sane defaults when only PI_SANDBOX is set", () => {
    const a = buildSandboxPodmanArgs({
      cwd: CWD,
      piArgs: ["-p"],
      env: { PI_SANDBOX: "1", PI_WORKER_HOME: "/wh", PI_SANDBOX_PROXY: "http://p:1" },
    });
    expect(a).toContain("localhost/dua-factory-foreman:latest");
    const n = a.indexOf("--network");
    expect(a[n + 1]).toBe("pi-sandbox-net");
  });
});

describe("isSandboxLaunchFailureExit (fail-closed classifier)", () => {
  it("treats podman launch codes 125/126/127 as a sandbox-launch failure", () => {
    for (const c of SANDBOX_LAUNCH_EXIT_CODES) expect(isSandboxLaunchFailureExit(c)).toBe(true);
  });

  it("does NOT treat an ordinary worker exit as a sandbox-launch failure", () => {
    // 1 = the worker ran inside the sandbox and failed → normal retry/valfix path
    expect(isSandboxLaunchFailureExit(1)).toBe(false);
    expect(isSandboxLaunchFailureExit(2)).toBe(false);
    expect(isSandboxLaunchFailureExit(0)).toBe(false);
    expect(isSandboxLaunchFailureExit(null)).toBe(false);
  });
});

describe("SandboxLaunchError", () => {
  it("carries the message + detail tail", () => {
    const e = new SandboxLaunchError("worker sandbox failed to launch: podman exited 125", "no such network");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("SandboxLaunchError");
    expect(e.detail).toBe("no such network");
  });
});

describe("sandboxParentEnv — parent podman reaches the rootless socket (ADR 0011)", () => {
  // The PARENT `podman` CLI needs the socket-locating vars; the WORKER container
  // must not. These are two distinct env surfaces.
  const base = { PATH: "/usr/bin", HOME: "/wh" } as NodeJS.ProcessEnv;

  it("adds the socket-locating vars from process.env when set", () => {
    const src = {
      CONTAINER_HOST: "unix:///run/podman/podman.sock",
      XDG_RUNTIME_DIR: "/run/user/1000",
      DOCKER_HOST: "unix:///run/docker.sock",
    } as NodeJS.ProcessEnv;
    const env = sandboxParentEnv(base, src);
    expect(env.CONTAINER_HOST).toBe("unix:///run/podman/podman.sock");
    expect(env.XDG_RUNTIME_DIR).toBe("/run/user/1000");
    expect(env.DOCKER_HOST).toBe("unix:///run/docker.sock");
    // base preserved
    expect(env.PATH).toBe("/usr/bin");
  });

  it("does NOT invent socket vars that aren't in the source env", () => {
    const env = sandboxParentEnv(base, {} as NodeJS.ProcessEnv);
    for (const k of PODMAN_SOCKET_ENV_VARS) expect(env[k]).toBeUndefined();
  });

  it("CRITICAL: the WORKER container -e list never receives CONTAINER_HOST/DOCKER_HOST/PI_SANDBOX even when they're in the source env", () => {
    // process.env has the socket vars set (parent needs them) — the container argv must still be clean.
    const env = {
      ...baseEnv,
      CONTAINER_HOST: "unix:///run/podman/podman.sock",
      DOCKER_HOST: "unix:///run/docker.sock",
      XDG_RUNTIME_DIR: "/run/user/1000",
    } as NodeJS.ProcessEnv;
    const argv = buildSandboxPodmanArgs({ cwd: CWD, piArgs: PI_ARGS, env });
    // collect every `-e KEY=VAL` value passed to the container
    const eFlags: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "-e") eFlags.push(argv[i + 1]!);
    }
    const eKeys = eFlags.map((kv) => kv.split("=")[0]);
    expect(eKeys).not.toContain("CONTAINER_HOST");
    expect(eKeys).not.toContain("DOCKER_HOST");
    expect(eKeys).not.toContain("XDG_RUNTIME_DIR");
    expect(eKeys).not.toContain("PI_SANDBOX");
    // and definitely not as raw substrings anywhere in the argv
    const joined = argv.join(" ");
    expect(joined).not.toContain("CONTAINER_HOST");
    expect(joined).not.toContain("DOCKER_HOST");
    expect(joined).not.toContain("/run/podman/podman.sock");
  });
});
