import { importTerminalEventSchema } from "@stockflow/shared";
import {
  PrismaClient,
  ImportRecoveryTerminalStatus,
  RecoveryItemStatus,
  ImportStatus,
} from "@prisma/client";
import type { SQSHandler } from "aws-lambda";

const prisma = new PrismaClient();

type TerminalEvent = {
  id?: string;
  detail?: {
    executionArn?: string;
    status?: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "ABORTED";
    error?: string;
    cause?: string;
    importJobId?: string;
    input?: unknown;
  };
};

async function persistTerminalEvent(event: TerminalEvent, receiveCount: number): Promise<void> {
  const detail = event.detail ?? {};
  const executionArn = detail.executionArn;
  const eventId = event.id;
  let input = detail.input;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      input = undefined;
    }
  }
  const inputJobId =
    input && typeof input === "object" && "importJobId" in input
      ? String(input.importJobId)
      : undefined;
  const inputKey =
    input && typeof input === "object" && "key" in input ? String(input.key) : undefined;
  const replayOf =
    input && typeof input === "object" && "replayOf" in input ? String(input.replayOf) : undefined;
  const keyJobId = inputKey ? inputKey.split("/").pop()?.slice(0, 36) : undefined;
  const importJobId = detail.importJobId ?? inputJobId ?? keyJobId;
  if (detail.status === "SUCCEEDED") {
    const successIdentity = [
      ...(replayOf ? [{ id: replayOf }] : []),
      ...(executionArn ? [{ executionArn }] : []),
      ...(importJobId ? [{ importJobId, status: RecoveryItemStatus.REPLAYING }] : []),
    ];
    if (successIdentity.length === 0) {
      throw new Error("Successful execution event cannot be correlated to a recovery item");
    }
    await prisma.importRecoveryItem.updateMany({
      where: { OR: successIdentity },
      data: { status: RecoveryItemStatus.RESOLVED, resolvedAt: new Date() },
    });
    return;
  }

  if (!importJobId)
    throw new Error("Terminal execution event cannot be correlated to an import job");

  const terminalStatus =
    detail.status === "TIMED_OUT"
      ? ImportRecoveryTerminalStatus.TIMED_OUT
      : detail.status === "ABORTED"
        ? ImportRecoveryTerminalStatus.ABORTED
        : ImportRecoveryTerminalStatus.FAILED;
  const safeMessage = "Import execution reached a terminal failure and is available for recovery.";
  const identity = [...(executionArn ? [{ executionArn }] : []), ...(eventId ? [{ eventId }] : [])];
  if (replayOf) {
    await prisma.importRecoveryItem.updateMany({
      where: { id: replayOf, status: RecoveryItemStatus.REPLAYING },
      data: { status: RecoveryItemStatus.RESOLVED, resolvedAt: new Date() },
    });
  }
  const existing = identity.length
    ? await prisma.importRecoveryItem.findFirst({ where: { OR: identity } })
    : null;
  if (existing) {
    await prisma.importRecoveryItem.update({
      where: { id: existing.id },
      data: {
        terminalStatus,
        receiveCount,
        errorCode: detail.error?.slice(0, 100) ?? "EXECUTION_FAILED",
        errorMessage: safeMessage,
      },
    });
  } else {
    await prisma.importRecoveryItem.create({
      data: {
        importJobId,
        executionArn,
        eventId,
        terminalStatus,
        receiveCount,
        errorCode: detail.error?.slice(0, 100) ?? "EXECUTION_FAILED",
        errorMessage: safeMessage,
      },
    });
  }
  await prisma.importJob.updateMany({
    where: { id: importJobId, status: { not: ImportStatus.COMPLETED } },
    data: { status: ImportStatus.FAILED, errorMessage: safeMessage },
  });
}

async function scanStaleJobs(): Promise<void> {
  const staleBefore = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const jobs = await prisma.importJob.findMany({
    where: {
      status: {
        in: [
          ImportStatus.PARSING,
          ImportStatus.VALIDATING,
          ImportStatus.CONFIRMING,
          ImportStatus.COMMITTING,
        ],
      },
      updatedAt: { lt: staleBefore },
    },
    select: { id: true, executionArn: true },
  });
  for (const job of jobs) {
    const existing = await prisma.importRecoveryItem.findFirst({
      where: {
        importJobId: job.id,
        status: { in: [RecoveryItemStatus.OPEN, RecoveryItemStatus.REPLAYING] },
      },
    });
    if (!existing) {
      await prisma.importRecoveryItem.create({
        data: {
          importJobId: job.id,
          executionArn: job.executionArn,
          terminalStatus: ImportRecoveryTerminalStatus.STALE,
          errorCode: "STALE_IMPORT",
          errorMessage: "Import execution exceeded the recovery scan threshold.",
        },
      });
    }
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportStatus.FAILED,
        errorMessage: "Import execution exceeded the recovery scan threshold.",
      },
    });
  }
}

export const handler: SQSHandler = async (event: any) => {
  if (!event.Records) {
    await scanStaleJobs();
    return { status: "SCANNED" };
  }
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records) {
    try {
      const parsed = JSON.parse(record.body);
      const result = importTerminalEventSchema.safeParse(parsed);
      if (!result.success) throw new Error("Invalid terminal execution event");
      await persistTerminalEvent(
        result.data,
        Number(record.attributes?.ApproximateReceiveCount ?? "1"),
      );
    } catch (error) {
      console.error("Import recovery event persistence failed", {
        messageId: record.messageId,
        errorCode: error instanceof Error ? error.name : "UNKNOWN",
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
};
