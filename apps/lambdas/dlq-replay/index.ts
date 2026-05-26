import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { PrismaClient, ImportStatus } from "@prisma/client";

const sfnClient = new SFNClient({});
const prisma = new PrismaClient();

/**
 * DLQ Replay Lambda
 *
 * Re-processes failed import jobs by restarting the Step Functions state machine.
 * Ensures idempotency — already-processed rows will be skipped by the writer lambda.
 *
 * Input event:
 *   - Single replay:  { importJobId: string }
 *   - Batch replay:   { importJobIds: string[] }
 *   - Auto mode:      { mode: "auto" }  — replays all FAILED jobs that still have an s3Key
 */
export const handler = async (event: any) => {
  console.log("DLQ replay event received:", JSON.stringify(event));

  const stateMachineArn = process.env.STATE_MACHINE_ARN;
  if (!stateMachineArn) {
    console.error("STATE_MACHINE_ARN environment variable is not set.");
    return { status: "FAILED", error: "Missing STATE_MACHINE_ARN" };
  }

  try {
    let jobIds: string[] = [];

    if (event.importJobId) {
      jobIds = [event.importJobId];
    } else if (event.importJobIds && Array.isArray(event.importJobIds)) {
      jobIds = event.importJobIds;
    } else if (event.mode === "auto") {
      // Auto-discover all FAILED jobs with S3 keys
      const failedJobs = await prisma.importJob.findMany({
        where: {
          status: { in: [ImportStatus.FAILED, ImportStatus.PARTIAL_FAILED] },
          s3Key: { not: null },
        },
        select: { id: true },
        take: 50, // Safety limit per invocation
      });
      jobIds = failedJobs.map((j) => j.id);
      console.log(`Auto mode: discovered ${jobIds.length} failed jobs to replay.`);
    }

    if (jobIds.length === 0) {
      console.log("No jobs to replay.");
      return { status: "NO_JOBS", replayed: 0 };
    }

    const results: Array<{ importJobId: string; status: string; error?: string }> = [];

    for (const jobId of jobIds) {
      try {
        const job = await prisma.importJob.findUnique({
          where: { id: jobId },
        });

        if (!job) {
          results.push({ importJobId: jobId, status: "NOT_FOUND", error: "Job not found" });
          continue;
        }

        if (!job.s3Key) {
          results.push({
            importJobId: jobId,
            status: "SKIPPED",
            error: "No S3 key — cannot replay a non-S3 import",
          });
          continue;
        }

        // Only replay FAILED or PARTIAL_FAILED jobs
        if (
          job.status !== ImportStatus.FAILED &&
          job.status !== ImportStatus.PARTIAL_FAILED
        ) {
          results.push({
            importJobId: jobId,
            status: "SKIPPED",
            error: `Job status is ${job.status}, not FAILED/PARTIAL_FAILED`,
          });
          continue;
        }

        // 1. Reset job status to UPLOADED for fresh pipeline run
        await prisma.importJob.update({
          where: { id: jobId },
          data: {
            status: ImportStatus.UPLOADED,
            errorMessage: null,
            awsTaskToken: null,
          },
        });

        // 2. Clear previously staged rows so parser can re-create them
        await prisma.importJobRow.deleteMany({
          where: { importJobId: jobId },
        });

        // 3. Extract bucket from S3 key pattern or use env var
        const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "";

        // 4. Start a new Step Functions execution
        const executionName = `dlq-replay-${jobId}-${Date.now()}`;
        await sfnClient.send(
          new StartExecutionCommand({
            stateMachineArn,
            name: executionName,
            input: JSON.stringify({
              bucket,
              key: job.s3Key,
              size: 0, // Size check will re-validate from S3
            }),
          })
        );

        console.log(`Successfully replayed job ${jobId}, execution: ${executionName}`);
        results.push({ importJobId: jobId, status: "REPLAYED" });
      } catch (jobErr: any) {
        console.error(`Failed to replay job ${jobId}:`, jobErr.message);
        results.push({ importJobId: jobId, status: "ERROR", error: jobErr.message });
      }
    }

    const replayed = results.filter((r) => r.status === "REPLAYED").length;
    console.log(`Replay complete. ${replayed}/${jobIds.length} jobs replayed.`);

    return {
      status: "COMPLETED",
      total: jobIds.length,
      replayed,
      results,
    };
  } catch (err: any) {
    console.error("DLQ replay critical error:", err);
    return {
      status: "FAILED",
      error: err.message,
    };
  } finally {
    await prisma.$disconnect();
  }
};
