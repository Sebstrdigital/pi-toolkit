import { describe, it, expect } from "vitest";
import { allowListedEnv } from "../src/env.js";

describe("allowListedEnv", () => {
  it("forwards allow-listed toolchain vars", () => {
    const env = allowListedEnv({ PATH: "/bin", HOME: "/home/me", LANG: "C", NODE_ENV: "test" });
    expect(env.PATH).toBe("/bin");
    expect(env.HOME).toBe("/home/me");
    expect(env.LANG).toBe("C");
    expect(env.NODE_ENV).toBe("test");
  });

  it("drops secret-bearing vars even if otherwise present", () => {
    const env = allowListedEnv({
      PATH: "/bin",
      GITHUB_TOKEN: "ghp_supersecret",
      ANTHROPIC_API_KEY: "sk-ant-xxx",
      AWS_SECRET_ACCESS_KEY: "abc",
      MY_PASSWORD: "hunter2",
      SESSION_COOKIE: "deadbeef",
    });
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.MY_PASSWORD).toBeUndefined();
    expect(env.SESSION_COOKIE).toBeUndefined();
  });

  it("drops anything not on the allow-list", () => {
    const env = allowListedEnv({ PATH: "/bin", RANDOM_APP_CONFIG: "value" });
    expect(env.RANDOM_APP_CONFIG).toBeUndefined();
  });

  it("always provides a PATH fallback", () => {
    const env = allowListedEnv({ HOME: "/home/me" });
    expect(env.PATH).toBeTruthy();
  });

  it("does not forward the real process.env GITHUB_TOKEN by default", () => {
    const prev = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "ghp_realtoken_should_not_leak";
    try {
      const env = allowListedEnv();
      expect(env.GITHUB_TOKEN).toBeUndefined();
    } finally {
      if (prev === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = prev;
    }
  });
});
