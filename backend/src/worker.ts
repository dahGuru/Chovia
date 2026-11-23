import { initRedis, disconnectRedis } from "./cache/redis.js";
import { startWorkers, stopWorkers } from "./jobs/index.js";
import { sentryService } from "./integrations/sentry/sentry.service.js";

sentryService.init();
await initRedis();

const workers = startWorkers();
console.log(`[CHOVIA WORKER] Active workers started: ${workers.length}`);

async function shutdown(signal: string) {
  console.log(`[CHOVIA WORKER] Received ${signal}. Shutting down workers...`);
  await stopWorkers();
  await disconnectRedis();
  console.log("[CHOVIA WORKER] Workers stopped gracefully.");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
