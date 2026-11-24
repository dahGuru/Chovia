import { initRedis, disconnectRedis } from "./cache/redis.js";
import { startWorkers, stopWorkers } from "./jobs/index.js";
import { outboxDispatcher } from "./jobs/outbox/outbox.dispatcher.js";
import { sentryService } from "./integrations/sentry/sentry.service.js";

sentryService.init();
await initRedis();

const workers = startWorkers();
console.log(`[CHOVIA WORKER] Active workers started: ${workers.length}`);

// Start continuous outbox dispatch loop (polls pending outbox events every 10s)
outboxDispatcher.start(10000);

async function shutdown(signal: string) {
  console.log(`[CHOVIA WORKER] Received ${signal}. Shutting down workers...`);
  await outboxDispatcher.stop();
  await stopWorkers();
  await disconnectRedis();
  console.log("[CHOVIA WORKER] Workers stopped gracefully.");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
