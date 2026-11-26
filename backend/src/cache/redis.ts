import { Redis, type RedisOptions } from "ioredis";
import { env } from "../config/env.js";

/**
 * Parses a Redis connection URL into strongly-typed RedisOptions,
 * strictly validating scheme (redis:// or rediss://), host, port, database index,
 * credentials, and TLS configuration.
 */
export function parseRedisUrl(redisUrl: string): RedisOptions {
  if (!redisUrl || typeof redisUrl !== "string") {
    throw new Error("Redis URL is required and must be a string");
  }

  let url: URL;
  try {
    url = new URL(redisUrl);
  } catch (err) {
    throw new Error(`Malformed Redis URL: ${(err as Error).message}`, { cause: err });
  }

  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error(
      `Unsupported Redis protocol: "${url.protocol}". Only "redis:" and "rediss:" are supported.`
    );
  }

  const isTls = url.protocol === "rediss:";

  if (!url.hostname || url.hostname.trim().length === 0) {
    throw new Error("Redis URL missing valid hostname");
  }

  // Reject query parameters to prevent ambiguous connection options or injection
  if (url.search && url.search.length > 1) {
    throw new Error(
      `Redis connection URL query parameters ("${url.search}") are not supported. Configure TLS and connection options explicitly.`
    );
  }

  // Reject localhost in production or staging
  if (
    (env.NODE_ENV === "production" || env.NODE_ENV === "staging") &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1" ||
      url.hostname === "[::1]")
  ) {
    throw new Error(`Localhost Redis URL is strictly forbidden in ${env.NODE_ENV}`);
  }

  let port = isTls ? 6380 : 6379;
  if (url.port) {
    port = Number.parseInt(url.port, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid Redis port: "${url.port}". Must be an integer between 1 and 65535.`);
    }
  }

  let dbIndex: number | undefined;
  if (url.pathname && url.pathname.length > 1) {
    const rawDb = url.pathname.slice(1);
    if (!/^\d+$/.test(rawDb)) {
      throw new Error(`Invalid Redis database path: "${url.pathname}". Must be a numeric database index.`);
    }
    dbIndex = Number.parseInt(rawDb, 10);
    if (dbIndex < 0 || dbIndex > 15) {
      throw new Error(`Redis database index ${dbIndex} out of valid range (0-15).`);
    }
  }

  let username: string | undefined;
  let password: string | undefined;
  try {
    if (url.username) username = decodeURIComponent(url.username);
    if (url.password) password = decodeURIComponent(url.password);
  } catch (err) {
    throw new Error(`Malformed credentials percent encoding in Redis URL: ${(err as Error).message}`, {
      cause: err,
    });
  }

  const options: RedisOptions = {
    host: url.hostname,
    port,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };

  if (username) {
    options.username = username;
  }
  if (password) {
    options.password = password;
  }
  if (dbIndex !== undefined) {
    options.db = dbIndex;
  }
  if (isTls) {
    options.tls = {
      rejectUnauthorized: env.NODE_ENV === "production" || env.NODE_ENV === "staging",
    };
  }

  return options;
}

// In-memory fallback strictly for local development or test mode
class MemoryCache {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<"OK"> {
    let expiresAt: number | undefined;
    if (mode === "EX" && typeof duration === "number") {
      expiresAt = Date.now() + duration * 1000;
    } else if (mode === "PX" && typeof duration === "number") {
      expiresAt = Date.now() + duration;
    }
    this.store.set(key, { value, ...(expiresAt !== undefined ? { expiresAt } : {}) });
    return "OK";
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const current = await this.get(key);
    if (current !== null) {
      return false;
    }
    await this.set(key, value, "EX", ttlSeconds);
    return true;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    const val = await this.get(key);
    return val !== null ? 1 : 0;
  }
}

export const memoryCache = new MemoryCache();

let isRedisReady = false;

const redisOptions = parseRedisUrl(env.REDIS_URL);
export const redis = new Redis({
  ...redisOptions,
  enableReadyCheck: true,
  retryStrategy(times: number) {
    if (env.NODE_ENV === "production" || env.NODE_ENV === "staging") {
      // In production/staging, keep retrying with exponential backoff up to 3s
      return Math.min(times * 200, 3000);
    }
    if (times > 3) {
      return null; // Stop retrying in local dev/test
    }
    return Math.min(times * 100, 1000);
  },
});

redis.on("ready", () => {
  isRedisReady = true;
});

redis.on("error", () => {
  isRedisReady = false;
});

redis.on("close", () => {
  isRedisReady = false;
});

redis.on("end", () => {
  isRedisReady = false;
});

export function isRedisClientReady(): boolean {
  return isRedisReady;
}

export async function initRedis(): Promise<void> {
  const isStrictEnv = env.NODE_ENV === "production" || env.NODE_ENV === "staging";

  try {
    await redis.connect();
    isRedisReady = true;
  } catch (error) {
    isRedisReady = false;
    if (isStrictEnv) {
      throw new Error(
        `Fatal: Failed to connect to Redis in ${env.NODE_ENV}. Security operations cannot run without distributed cache.`,
        { cause: error }
      );
    }
  }
}

export async function disconnectRedis(): Promise<void> {
  if (isRedisReady) {
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    } finally {
      isRedisReady = false;
    }
  }
}

export async function checkRedisConnection(): Promise<boolean> {
  try {
    if (!isRedisReady && redis.status !== "ready") {
      return false;
    }
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

/**
 * Atomically claims a one-time token (such as an OTP or password reset token).
 * Guarantees that concurrent requests cannot both consume the same token.
 */
export async function atomicConsumeToken(key: string, ttlSeconds: number): Promise<boolean> {
  const isStrictEnv = env.NODE_ENV === "production" || env.NODE_ENV === "staging";

  if (isRedisReady) {
    try {
      const res = await redis.set(key, "consumed", "EX", ttlSeconds, "NX");
      return res === "OK";
    } catch (error) {
      if (isStrictEnv) {
        throw new Error("Redis failure during atomic token verification", { cause: error });
      }
    }
  }

  if (isStrictEnv) {
    throw new Error(`Redis is offline. Cannot verify tokens in ${env.NODE_ENV}.`);
  }

  return memoryCache.setNx(key, "consumed", ttlSeconds);
}

export async function cacheGet(key: string): Promise<string | null> {
  const isStrictEnv = env.NODE_ENV === "production" || env.NODE_ENV === "staging";

  if (isRedisReady) {
    try {
      return await redis.get(key);
    } catch (error) {
      if (isStrictEnv) throw error;
      return memoryCache.get(key);
    }
  }

  if (isStrictEnv) {
    throw new Error(`Redis is offline. Cache read failed in ${env.NODE_ENV}.`);
  }

  return memoryCache.get(key);
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  const isStrictEnv = env.NODE_ENV === "production" || env.NODE_ENV === "staging";

  if (isRedisReady) {
    try {
      if (ttlSeconds) {
        await redis.set(key, value, "EX", ttlSeconds);
      } else {
        await redis.set(key, value);
      }
      return;
    } catch (error) {
      if (isStrictEnv) throw error;
    }
  }

  if (isStrictEnv) {
    throw new Error(`Redis is offline. Cache write failed in ${env.NODE_ENV}.`);
  }

  if (ttlSeconds) {
    await memoryCache.set(key, value, "EX", ttlSeconds);
  } else {
    await memoryCache.set(key, value);
  }
}

export async function cacheDel(key: string): Promise<void> {
  const isStrictEnv = env.NODE_ENV === "production" || env.NODE_ENV === "staging";

  if (isRedisReady) {
    try {
      await redis.del(key);
      return;
    } catch (error) {
      if (isStrictEnv) throw error;
    }
  }

  if (isStrictEnv) {
    throw new Error(`Redis is offline. Cache delete failed in ${env.NODE_ENV}.`);
  }

  await memoryCache.del(key);
}
