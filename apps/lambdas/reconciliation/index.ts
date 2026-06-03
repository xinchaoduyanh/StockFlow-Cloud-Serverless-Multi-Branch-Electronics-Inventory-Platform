import { PrismaClient, ReconciliationStatus, StockMovementType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Reconciliation Lambda
 *
 * Daily scheduled job (EventBridge cron) that verifies inventory consistency
 * by comparing current inventory quantities against the sum of all stock movements.
 *
 * For each (branch, component) pair:
 *   expected_quantity = SUM(stock_movements.quantity_change)
 *   actual_quantity   = inventory.quantity
 *
 * If mismatch → creates a ReconciliationIssue record and logs the discrepancy.
 *
 * Input event: { dryRun?: boolean }
 */
const handler = async (event: any) => {
  console.log("Reconciliation event received:", JSON.stringify(event));

  const dryRun = event?.dryRun === true;
  const runId = `recon-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  try {
    console.log(`Starting reconciliation run: ${runId} (dryRun: ${dryRun})`);

    // 1. Fetch all inventory records
    const inventoryRecords = await prisma.inventory.findMany({
      include: {
        branch: { select: { code: true, name: true } },
        component: { select: { sku: true, name: true } },
      },
    });

    console.log(`Found ${inventoryRecords.length} inventory records to reconcile.`);

    // 2. For each inventory record, calculate expected quantity from stock movements
    let issuesFound = 0;
    let matchedCount = 0;
    const issues: Array<{
      branchId: string;
      branchCode: string;
      componentId: string;
      sku: string;
      expected: number;
      actual: number;
      difference: number;
    }> = [];

    for (const record of inventoryRecords) {
      // Sum all stock movements for this branch/component pair
      const movementSum = await prisma.stockMovement.aggregate({
        where: {
          branchId: record.branchId,
          componentId: record.componentId,
        },
        _sum: {
          quantityChange: true,
        },
      });

      const expectedQuantity = movementSum._sum.quantityChange || 0;
      const actualQuantity = record.quantity;
      const difference = actualQuantity - expectedQuantity;

      if (difference !== 0) {
        issuesFound++;
        issues.push({
          branchId: record.branchId,
          branchCode: record.branch.code,
          componentId: record.componentId,
          sku: record.component.sku,
          expected: expectedQuantity,
          actual: actualQuantity,
          difference,
        });

        console.warn(
          `MISMATCH: ${record.branch.code}/${record.component.sku} — ` +
            `expected: ${expectedQuantity}, actual: ${actualQuantity}, diff: ${difference}`,
        );
      } else {
        matchedCount++;
      }
    }

    // 3. Check for orphaned movements (movements without matching inventory records)
    const orphanedMovements = await prisma.$queryRaw<
      Array<{ branch_id: string; component_id: string; total_change: bigint }>
    >`
      SELECT sm.branch_id, sm.component_id, SUM(sm.quantity_change) as total_change
      FROM stock_movements sm
      LEFT JOIN inventory i ON sm.branch_id = i.branch_id AND sm.component_id = i.component_id
      WHERE i.branch_id IS NULL
      GROUP BY sm.branch_id, sm.component_id
    `;

    for (const orphan of orphanedMovements) {
      const expectedQty = Number(orphan.total_change);
      issuesFound++;
      issues.push({
        branchId: orphan.branch_id,
        branchCode: "ORPHAN",
        componentId: orphan.component_id,
        sku: "ORPHAN",
        expected: expectedQty,
        actual: 0,
        difference: -expectedQty,
      });

      console.warn(
        `ORPHAN: branch=${orphan.branch_id}, component=${orphan.component_id} — ` +
          `movements sum to ${expectedQty} but no inventory record exists`,
      );
    }

    // 4. Persist issues to database (unless dry run)
    if (!dryRun && issues.length > 0) {
      // Close any stale OPEN issues from previous runs that are now resolved
      const currentPairs = issues.map((i) => `${i.branchId}:${i.componentId}`);

      const previousOpenIssues = await prisma.reconciliationIssue.findMany({
        where: { status: ReconciliationStatus.OPEN },
      });

      const autoResolved: string[] = [];
      for (const prev of previousOpenIssues) {
        const key = `${prev.branchId}:${prev.componentId}`;
        if (!currentPairs.includes(key)) {
          autoResolved.push(prev.id);
        }
      }

      if (autoResolved.length > 0) {
        await prisma.reconciliationIssue.updateMany({
          where: { id: { in: autoResolved } },
          data: {
            status: ReconciliationStatus.RESOLVED,
            resolvedAt: new Date(),
          },
        });
        console.log(`Auto-resolved ${autoResolved.length} previously open issues.`);
      }

      // Upsert current issues
      for (const issue of issues) {
        const existing = await prisma.reconciliationIssue.findFirst({
          where: {
            branchId: issue.branchId,
            componentId: issue.componentId,
            status: ReconciliationStatus.OPEN,
          },
        });

        let issueId: string;

        if (existing) {
          // Update existing open issue with latest values
          const updated = await prisma.reconciliationIssue.update({
            where: { id: existing.id },
            data: {
              expectedQuantity: issue.expected,
              actualQuantity: issue.actual,
              difference: issue.difference,
              runId,
              detectedAt: new Date(),
            },
          });
          issueId = updated.id;
        } else {
          const created = await prisma.reconciliationIssue.create({
            data: {
              branchId: issue.branchId,
              componentId: issue.componentId,
              expectedQuantity: issue.expected,
              actualQuantity: issue.actual,
              difference: issue.difference,
              status: ReconciliationStatus.OPEN,
              runId,
            },
          });
          issueId = created.id;
        }

        // Notify admins in the database
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN" },
        });

        for (const admin of admins) {
          try {
            await prisma.notification.create({
              data: {
                userId: admin.id,
                title: "Cảnh báo đối soát tồn kho",
                message: `Phát hiện sai lệch tại chi nhánh ${issue.branchCode} đối với sản phẩm SKU ${issue.sku} (chênh lệch: ${issue.difference})`,
                type: "RECONCILIATION_ALERT",
                metadata: {
                  issueId,
                  branchId: issue.branchId,
                  branchCode: issue.branchCode,
                  sku: issue.sku,
                  difference: issue.difference,
                },
              },
            });
          } catch (err: any) {
            console.error(`Failed to create admin notification for user ${admin.id}:`, err);
          }
        }
      }

      console.log(`Persisted ${issues.length} reconciliation issues to database.`);
    }

    const summary = {
      status: "COMPLETED",
      runId,
      dryRun,
      totalRecords: inventoryRecords.length,
      matched: matchedCount,
      mismatches: issuesFound,
      orphanedMovements: orphanedMovements.length,
      issues: issues.map((i) => ({
        branch: i.branchCode,
        sku: i.sku,
        expected: i.expected,
        actual: i.actual,
        difference: i.difference,
      })),
    };

    console.log("Reconciliation summary:", JSON.stringify(summary, null, 2));

    return summary;
  } catch (err: any) {
    console.error("Reconciliation failed:", err);
    return {
      status: "FAILED",
      runId,
      error: err.message,
    };
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = { handler };
