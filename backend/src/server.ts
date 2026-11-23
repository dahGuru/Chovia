import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { disconnectDatabase } from "./database/prisma.js";
import { initRedis, disconnectRedis } from "./cache/redis.js";
import { stopWorkers } from "./jobs/index.js";
import { sentryService } from "./integrations/sentry/sentry.service.js";

// Initialize Sentry error reporting
sentryService.init();

// Initialize Redis connection
await initRedis();

const app = await buildApp();

async function shutdown(signal: string) {
  app.log.info({ signal }, "Gracefully terminating CHOVIA API...");
  try {
    await app.close();
    await disconnectDatabase();
    await stopWorkers();
    await disconnectRedis();
    app.log.info("CHOVIA API gracefully shut down.");
    process.exit(0);
  } catch (err) {
    app.log.error(err, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(
    `CHOVIA API server active at http://${env.HOST}:${env.PORT} (Docs at /api/docs)`
  );
} catch (error) {
  app.log.error(error, "Unable to start CHOVIA API");
  process.exitCode = 1;
}
