import { safeFetch } from "./security/safeFetch";

/**
 * robots.txt compliance check (longest-match algorithm, User-agent: * group only).
 * Non-negotiable project guardrail — see AGENTS.md / handover.md.
 */

interface RobotsRules {
  allow: string[];
  disallow: string[];
}

const robotsCache = new Map<string, RobotsRules | null>();

function parseRobotsTxt(text: string): RobotsRules {
  const allow: string[] = [];
  const disallow: string[] = [];
  let inWildcardGroup = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === "user-agent") {
      inWildcardGroup = value === "*";
      continue;
    }
    if (!inWildcardGroup) continue;

    if (key === "disallow" && value) disallow.push(value);
    if (key === "allow" && value) allow.push(value);
  }

  return { allow, disallow };
}

async function fetchRobotsRules(origin: string): Promise<RobotsRules | null> {
  if (robotsCache.has(origin)) return robotsCache.get(origin) ?? null;

  try {
    const res = await safeFetch(`${origin}/robots.txt`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      robotsCache.set(origin, null);
      return null;
    }
    const rules = parseRobotsTxt(await res.text());
    robotsCache.set(origin, rules);
    return rules;
  } catch {
    // No robots.txt or unreachable — treat as "no restrictions declared".
    robotsCache.set(origin, null);
    return null;
  }
}

/** Longest matching rule wins, per the de-facto robots.txt spec. */
export async function isAllowedByRobots(url: string): Promise<boolean> {
  const parsed = new URL(url);
  const rules = await fetchRobotsRules(parsed.origin);
  if (!rules) return true;

  const path = parsed.pathname + parsed.search;
  const longestMatch = (patterns: string[]) =>
    Math.max(0, ...patterns.filter((rule) => path.startsWith(rule)).map((rule) => rule.length));

  const longestDisallow = longestMatch(rules.disallow);
  if (longestDisallow === 0) return true;

  const longestAllow = longestMatch(rules.allow);
  return longestAllow >= longestDisallow;
}
