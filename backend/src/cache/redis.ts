import { Redis, type RedisOptions } from "ioredis";
import { env } from "../config/env.js";

/**
 * Parses a Redis connection URL into strongly-typed RedisOptions,
 * preserving TLS (rediss://), username, password, port, and db index.
 */
export function parseRedisUrl(redisUrl: string): RedisOptions {
  try {
    const url = new URL(redisUrl);
    const isTls = url.protocol === "rediss:";
    const dbIndex =
      url.pathname && url.pathname.length > 1
        ? Number.parseInt(url.pathname.slice(1), 10)
        : undefined;

    const options: RedisOptions = {
      host: url.hostname || "127.0.0.1",
      port: Number.parseInt(url.port || (isTls ? "6380" : "6379"), 10),
      maxRetriesPerRequest: null,
      lazyConnect: true,
    };

    if (url.username) {
      options.username = decodeURIComponent(url.username);
    }
    if (url.password) {
      options.password = decodeURIComponent(url.password);
    }
    if (dbIndex !== undefined && !Number.isNaN(dbIndex)) {
      options.db = dbIndex;
    }
    if (isTls) {
      options.tls = {};
    }

    return options;
  } catch {
    // Fallback if URL parsing fails
    return {
      host: "127.0.0.1",
      port: 6379,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    };
  }
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
