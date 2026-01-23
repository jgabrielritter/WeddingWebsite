export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  source: "memory" | "upstash";
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const memoryBuckets = new Map<string, RateLimitEntry>();

export function getNetlifyClientIp(
  headers: Record<string, string | undefined>
): string {
  const direct = headers["x-nf-client-connection-ip"];
  if (direct) {
    return direct;
  }
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return headers["x-real-ip"] ?? "unknown";
}

export function isHoneypotTripped(value: string | undefined | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function isTimingTrapTripped(
  startTs: number | null,
  now = Date.now(),
  minElapsedMs = 800
): boolean {
  if (!startTs || Number.isNaN(startTs)) {
    return false;
  }
  return now - startTs < minElapsedMs;
}

function consumeMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number
): RateLimitResult {
  const entry = memoryBuckets.get(key);
  if (!entry || now >= entry.resetAt) {
    const resetAt = now + windowMs;
    memoryBuckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt, source: "memory" };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, source: "memory" };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
    source: "memory",
  };
}

async function consumeUpstashRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
  fetchFn: typeof fetch
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return consumeMemoryRateLimit(key, limit, windowMs, now);
  }

  const response = await fetchFn(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["PTTL", key],
      ["PEXPIRE", key, windowMs],
    ]),
  });

  if (!response.ok) {
    throw new Error(`Upstash request failed with ${response.status}`);
  }

  const json = (await response.json()) as Array<{ result?: number }>;
  const count = Number(json?.[0]?.result ?? 0);
  const ttl = Number(json?.[1]?.result ?? -1);
  const resetAt = now + (ttl > 0 ? ttl : windowMs);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    source: "upstash",
  };
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  options?: { now?: number; fetchFn?: typeof fetch }
): Promise<RateLimitResult> {
  const now = options?.now ?? Date.now();
  const fetchFn = options?.fetchFn ?? fetch;
  const hasUpstash =
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

  if (!hasUpstash) {
    return consumeMemoryRateLimit(key, limit, windowMs, now);
  }

  try {
    return await consumeUpstashRateLimit(key, limit, windowMs, now, fetchFn);
  } catch {
    return consumeMemoryRateLimit(key, limit, windowMs, now);
  }
}
