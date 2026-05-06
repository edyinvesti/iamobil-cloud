/** @vitest-environment node */

import { describe, expect, it } from "vitest";

describe("server network policy", () => {
  it("defaults to wildcard host", async () => {
    const { resolveHosts, resolveHost } = await import("../../server/network-policy");
    expect(resolveHosts({} as unknown as NodeJS.ProcessEnv)).toEqual(["0.0.0.0"]);
    expect(resolveHost({} as unknown as NodeJS.ProcessEnv)).toBe("0.0.0.0");
  });

  it("ignores HOSTNAME and uses only HOST for bind resolution", async () => {
    const { resolveHosts, resolveHost } = await import("../../server/network-policy");
    expect(resolveHosts({ HOSTNAME: "example-host" } as unknown as NodeJS.ProcessEnv)).toEqual([
      "0.0.0.0",
    ]);
    expect(resolveHost({ HOSTNAME: "example-host" } as unknown as NodeJS.ProcessEnv)).toBe("0.0.0.0");
    expect(
      resolveHosts({ HOST: "0.0.0.0", HOSTNAME: "example-host" } as unknown as NodeJS.ProcessEnv)
    ).toEqual(["0.0.0.0"]);
    expect(
      resolveHost({ HOST: "0.0.0.0", HOSTNAME: "example-host" } as unknown as NodeJS.ProcessEnv)
    ).toBe("0.0.0.0");
  });

  it("classifies wildcard and non-loopback hosts as public", async () => {
    const { isPublicHost } = await import("../../server/network-policy");
    expect(isPublicHost("0.0.0.0")).toBe(true);
    expect(isPublicHost("::")).toBe(true);
    expect(isPublicHost("studio.example.com")).toBe(true);
  });

  it("classifies loopback hosts as non-public", async () => {
    const { isPublicHost } = await import("../../server/network-policy");
    expect(isPublicHost("127.0.0.1")).toBe(false);
    expect(isPublicHost("::1")).toBe(false);
    expect(isPublicHost("0:0:0:0:0:0:0:1")).toBe(false);
    expect(isPublicHost("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicHost("[::1]:3000")).toBe(false);
    expect(isPublicHost("localhost")).toBe(false);
  });

  it("classifies non-loopback IPv6 addresses as public", async () => {
    const { isPublicHost } = await import("../../server/network-policy");
    expect(isPublicHost("::ffff:192.168.1.10")).toBe(true);
  });

  it("assertPublicHostAllowed does not throw (warning only)", async () => {
    const { assertPublicHostAllowed } = await import("../../server/network-policy");
    // Should not throw because it only console.warns now
    expect(() => assertPublicHostAllowed({ host: "0.0.0.0", studioAccessToken: "" })).not.toThrow();
    expect(() =>
      assertPublicHostAllowed({ host: "0.0.0.0", studioAccessToken: "abc" })
    ).not.toThrow();
  });
});
