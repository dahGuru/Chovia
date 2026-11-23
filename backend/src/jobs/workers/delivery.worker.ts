import { Worker } from "bullmq";
import { env } from "../../config/env.js";
import { parseRedisUrl } from "../../cache/redis.js";
import { QUEUE_NAMES } from "../constants/jobs.constants.js";
import { processDeliveryJob } from "../processors/delivery.processor.js";
import { sentryService } from "../../integrations/sentry/sentry.service.js";

function getWorkerConnection() {
  return parseRedisUrl(env.REDIS_URL);
}

export function createDeliveryWorker(): Worker | null {
  if (env.NODE_ENV === "test" || env.MOCK_INTEGRATIONS) {
    return null;
  }

  const worker = new Worker(QUEUE_NAMES.DELIVERY, processDeliveryJob, {
    connection: getWorkerConnection(),
    concurrency: 3,
  });

  worker.on("failed", (job, error) => {
    sentryService.captureJobError(error, {
      queueName: QUEUE_NAMES.DELIVERY,
      jobName: job?.name || "unknown",
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
    });
  });

  return worker;
}
