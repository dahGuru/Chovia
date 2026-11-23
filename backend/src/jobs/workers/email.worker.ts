import { Worker } from "bullmq";
import { env } from "../../config/env.js";
import { parseRedisUrl } from "../../cache/redis.js";
import { QUEUE_NAMES } from "../constants/jobs.constants.js";
import { processEmailJob } from "../processors/email.processor.js";
import { sentryService } from "../../integrations/sentry/sentry.service.js";

function getWorkerConnection() {
  return parseRedisUrl(env.REDIS_URL);
}

export function createEmailWorker(): Worker | null {
  if (env.NODE_ENV === "test" || env.MOCK_INTEGRATIONS) {
    return null;
  }

  const worker = new Worker(QUEUE_NAMES.EMAIL, processEmailJob, {
    connection: getWorkerConnection(),
    concurrency: 5,
  });

  worker.on("failed", (job, error) => {
    sentryService.captureJobError(error, {
      queueName: QUEUE_NAMES.EMAIL,
      jobName: job?.name || "unknown",
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
    });
  });

  return worker;
}
