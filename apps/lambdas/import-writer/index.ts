import { ImportPipelineAction, StockMovementReferenceType } from "@stockflow/shared";
import { PrismaClient, ImportStatus, ImportRowStatus, StockMovementType } from "@prisma/client";

const prisma = new PrismaClient();

export const handler = async (event: any) => {
  console.log("Writer event received:", JSON.stringify(event));

  const { importJobId, action } = event;

  if (!importJobId) {
    console.error("Missing importJobId in request payload.");
    return { status: "FAILED", error: "Missing importJobId" };
  }

  try {
    const job = await prisma.importJob.findUnique({
      where: { id: importJobId },
    });

    if (!job) {
      console.error(`Import job ${importJobId} not found.`);
      return { status: "FAILED", error: "Import job not found" };
    }

    // 1. Check for CANCEL action
    if (action === ImportPipelineAction.CANCEL || job.status === ImportStatus.CANCELLED) {
      await prisma.importJob.update({
        where: { id: importJobId },
        data: { status: ImportStatus.CANCELLED },
      });
      console.log(`Job ${importJobId} cancelled by request.`);
      return { status: "CANCELLED", importJobId };
    }

    // 2. Transition status to COMMITTING
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: ImportStatus.COMMITTING },
    });

    // 3. Retrieve all VALID staged rows
    const stagedRows = await prisma.importJobRow.findMany({
      where: {
        importJobId,
        validationStatus: ImportRowStatus.VALID,
      },
      orderBy: { rowNumber: "asc" },
    });

    console.log(`Retrieved ${stagedRows.length} valid rows to commit.`);

    let committedRows = 0;
    const CHUNK_SIZE = 500;

    const toSpecs = (row: any) => {
      return {
        ddrGeneration: row.ddrGeneration,
        speedMhz: row.speedMhz,
        capacityGb: row.capacityGb,
        socket: row.socket,
        cores: row.cores,
        threads: row.threads,
        interface: row.interface,
        formFactor: row.formFactor,
        vramGb: row.vramGb,
        chipset: row.chipset,
        wattage: row.wattage,
        efficiencyRating: row.efficiencyRating,
        modular: row.modular,
        caseSize: row.caseSize,
        supportedMainboard: row.supportedMainboard,
        coolerType: row.coolerType,
        supportedSocket: row.supportedSocket,
      };
    };

    // 4. Batch transaction commit loop
    for (let i = 0; i < stagedRows.length; i += CHUNK_SIZE) {
      const chunk = stagedRows.slice(i, i + CHUNK_SIZE);
      console.log(
        `Processing chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(stagedRows.length / CHUNK_SIZE)}`,
      );

      try {
        await prisma.$transaction(
          async (tx) => {
            for (const row of chunk) {
              const data = row.normalizedData as any;

              // Upsert the core component record
              const component = await tx.component.upsert({
                where: { sku: data.sku },
                update: {
                  name: data.name,
                  brand: data.brand,
                  category: data.category,
                  specs: toSpecs(data),
                  unitPrice: data.unitPrice,
                  supplier: data.supplier,
                  warrantyMonths: data.warrantyMonths,
                },
                create: {
                  sku: data.sku,
                  name: data.name,
                  brand: data.brand,
                  category: data.category,
                  specs: toSpecs(data),
                  unitPrice: data.unitPrice,
                  supplier: data.supplier,
                  warrantyMonths: data.warrantyMonths,
                },
              });

              // Upsert the inventory stock balance
              await tx.inventory.upsert({
                where: {
                  branchId_componentId: {
                    branchId: job.branchId,
                    componentId: component.id,
                  },
                },
                update: {
                  quantity: { increment: data.quantity },
                  version: { increment: 1 },
                },
                create: {
                  branchId: job.branchId,
                  componentId: component.id,
                  quantity: data.quantity,
                },
              });

              // Create stock movement ledger audit entry
              await tx.stockMovement.create({
                data: {
                  branchId: job.branchId,
                  componentId: component.id,
                  movementType: StockMovementType.IMPORT_IN,
                  quantityChange: data.quantity,
                  referenceType: StockMovementReferenceType.IMPORT_JOB,
                  referenceId: job.id,
                  createdBy: job.createdBy,
                },
              });

              // Update staged row state to COMMITTED
              await tx.importJobRow.update({
                where: { id: row.id },
                data: {
                  validationStatus: ImportRowStatus.COMMITTED,
                  processedAt: new Date(),
                },
              });
            }
          },
          {
            timeout: 20000, // 20s timeout limit to protect Neon pgBouncer pool
          },
        );

        committedRows += chunk.length;
        console.log(`Successfully committed chunk. Progressive total: ${committedRows}`);
      } catch (chunkErr: any) {
        console.error(`Chunk transaction failed: ${chunkErr.message}`);

        // Mark only the failed rows in this chunk as FAILED so remaining batches aren't locked out
        const chunkIds = chunk.map((r) => r.id);
        await prisma.importJobRow.updateMany({
          where: { id: { in: chunkIds } },
          data: {
            validationStatus: ImportRowStatus.FAILED,
            errorMessage: `Transaction failed: ${chunkErr.message}`,
          },
        });
      }

      // Update progressive counters on the parent job record
      await prisma.importJob.update({
        where: { id: importJobId },
        data: { committedRows },
      });
    }

    // 5. Finalize Parent Job Status
    const finalStatus =
      committedRows === stagedRows.length
        ? ImportStatus.COMPLETED
        : committedRows > 0
          ? ImportStatus.PARTIAL_FAILED
          : ImportStatus.FAILED;

    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
      },
    });

    console.log(`Job finishing with status: ${finalStatus}. Total committed: ${committedRows}`);

    return {
      status: finalStatus,
      importJobId,
      committedRows,
    };
  } catch (err: any) {
    console.error("Critical writer execution exception:", err);
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: ImportStatus.FAILED,
        errorMessage: `Critical commit error: ${err.message}`,
      },
    });
    return {
      status: "FAILED",
      importJobId,
      error: err.message,
    };
  } finally {
    await prisma.$disconnect();
  }
};
