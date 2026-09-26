import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./security/safeFetch", () => ({
  safeFetch: vi.fn(),
}));

const { safeFetch } = await import("./security/safeFetch");
const { isAllowedByRobots } = await import("./robots");

function mockRobotsTxt(body: string, ok = true) {
  vi.mocked(safeFetch).mockResolvedValue({
    ok,
    text: () => Promise.resolve(body),
  } as Response);
}

describe("isAllowedByRobots", () => {
  afterEach(() => {
    vi.mocked(safeFetch).mockReset();
  });

  it("allows a path with no matching disallow rule", async () => {
    mockRobotsTxt("User-agent: *\nDisallow: /private\n");
    expect(await isAllowedByRobots("https://robots-test-allow.example/public")).toBe(true);
  });

  it("blocks a path matching a disallow rule", async () => {
    mockRobotsTxt("User-agent: *\nDisallow: /private\n");
    expect(await isAllowedByRobots("https://robots-test-block.example/private/page")).toBe(false);
  });

  it("lets a more specific allow override a disallow", async () => {
    mockRobotsTxt("User-agent: *\nDisallow: /private\nAllow: /private/public\n");
    expect(await isAllowedByRobots("https://robots-test-override.example/private/public/page")).toBe(true);
  });

  it("ignores rules under a non-wildcard user-agent group", async () => {
    mockRobotsTxt("User-agent: SomeOtherBot\nDisallow: /everything\n");
    expect(await isAllowedByRobots("https://robots-test-other-agent.example/everything")).toBe(true);
  });

  it("treats a missing robots.txt as no restrictions", async () => {
    mockRobotsTxt("", false);
    expect(await isAllowedByRobots("https://robots-test-missing.example/anything")).toBe(true);
  });
});
