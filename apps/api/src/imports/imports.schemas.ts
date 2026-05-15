import { ComponentCategory } from "@prisma/client";
import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas/pagination.schema";

export const importRowInputSchema = z
  .object({
    sku: z.string().trim().min(1),
    name: z.string().trim().min(1),
    brand: z.string().trim().optional(),
    category: z.nativeEnum(ComponentCategory),
    quantity: z.number().int().min(0),
    unitPrice: z.number().min(0).optional(),
    supplier: z.string().trim().optional(),
    warrantyMonths: z.number().int().min(0).optional(),
    ddrGeneration: z.enum(["DDR3", "DDR4", "DDR5"]).optional(),
    speedMhz: z.number().int().positive().optional(),
    capacityGb: z.number().int().positive().optional(),
    socket: z.string().trim().optional(),
    cores: z.number().int().positive().optional(),
    threads: z.number().int().positive().optional(),
    interface: z.enum(["NVMe", "SATA"]).optional(),
    formFactor: z.string().trim().optional(),
    vramGb: z.number().int().positive().optional(),
    chipset: z.string().trim().optional(),
  })
  .superRefine((row, context) => {
    if (row.category === ComponentCategory.RAM) {
      for (const field of ["ddrGeneration", "speedMhz", "capacityGb"] as const) {
        if (!row[field]) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `${field} is required for RAM`,
          });
        }
      }
    }

    if (row.category === ComponentCategory.CPU) {
      if (!row.socket) {
        context.addIssue({ code: "custom", path: ["socket"], message: "socket is required for CPU" });
      }
      if (!row.cores) {
        context.addIssue({ code: "custom", path: ["cores"], message: "cores is required for CPU" });
      }
      if (row.threads && row.cores && row.threads < row.cores) {
        context.addIssue({ code: "custom", path: ["threads"], message: "threads must be >= cores" });
      }
    }

    if (row.category === ComponentCategory.SSD) {
      if (!row.interface) {
        context.addIssue({ code: "custom", path: ["interface"], message: "interface is required for SSD" });
      }
      if (!row.capacityGb) {
        context.addIssue({ code: "custom", path: ["capacityGb"], message: "capacityGb is required for SSD" });
      }
    }

    if (row.category === ComponentCategory.GPU && !row.vramGb) {
      context.addIssue({ code: "custom", path: ["vramGb"], message: "vramGb is required for GPU" });
    }

    if (row.category === ComponentCategory.MAINBOARD) {
      if (!row.socket) {
        context.addIssue({ code: "custom", path: ["socket"], message: "socket is required for MAINBOARD" });
      }
      if (!row.chipset) {
        context.addIssue({ code: "custom", path: ["chipset"], message: "chipset is required for MAINBOARD" });
      }
    }
  });

export const initImportBodySchema = z.object({
  branchId: z.string().uuid(),
  fileName: z.string().trim().min(1),
  s3Key: z.string().trim().optional(),
  rows: z.array(importRowInputSchema).optional(),
});

export const startImportBodySchema = z.object({
  rows: z.array(importRowInputSchema).min(1),
});

export const importListQuerySchema = paginationQuerySchema.extend({
  branchId: z.string().uuid().optional(),
});

export const uploadImportBodySchema = z.object({
  branchId: z.string().uuid(),
});

export type ImportRowInput = z.infer<typeof importRowInputSchema>;
export type InitImportBody = z.infer<typeof initImportBodySchema>;
export type StartImportBody = z.infer<typeof startImportBodySchema>;
export type ImportListQuery = z.infer<typeof importListQuerySchema>;
export type UploadImportBody = z.infer<typeof uploadImportBodySchema>;
