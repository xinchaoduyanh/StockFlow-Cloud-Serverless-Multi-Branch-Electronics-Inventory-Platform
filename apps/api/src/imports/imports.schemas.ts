import { ComponentCategory } from "@prisma/client";
import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas/pagination.schema";

export const importRowInputSchema = z
  .object({
    sku: z.string().trim().min(1),
    name: z.string().trim().min(1),
    brand: z.string().trim().optional(),
    category: z.nativeEnum(ComponentCategory),
    quantity: z.number().int().positive("quantity must be greater than 0"),
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
    wattage: z.number().int().positive().optional(),
    efficiencyRating: z.string().trim().optional(),
    modular: z.string().trim().optional(),
    caseSize: z.string().trim().optional(),
    supportedMainboard: z.string().trim().optional(),
    coolerType: z.string().trim().optional(),
    supportedSocket: z.string().trim().optional(),
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
        context.addIssue({
          code: "custom",
          path: ["socket"],
          message: "socket is required for CPU",
        });
      }
      if (!row.cores) {
        context.addIssue({ code: "custom", path: ["cores"], message: "cores is required for CPU" });
      }
      if (row.threads && row.cores && row.threads < row.cores) {
        context.addIssue({
          code: "custom",
          path: ["threads"],
          message: "threads must be >= cores",
        });
      }
    }

    if (row.category === ComponentCategory.SSD) {
      if (!row.interface) {
        context.addIssue({
          code: "custom",
          path: ["interface"],
          message: "interface is required for SSD",
        });
      }
      if (!row.capacityGb) {
        context.addIssue({
          code: "custom",
          path: ["capacityGb"],
          message: "capacityGb is required for SSD",
        });
      }
    }

    if (row.category === ComponentCategory.GPU && !row.vramGb) {
      context.addIssue({ code: "custom", path: ["vramGb"], message: "vramGb is required for GPU" });
    }

    if (row.category === ComponentCategory.MAINBOARD) {
      if (!row.socket) {
        context.addIssue({
          code: "custom",
          path: ["socket"],
          message: "socket is required for MAINBOARD",
        });
      }
      if (!row.chipset) {
        context.addIssue({
          code: "custom",
          path: ["chipset"],
          message: "chipset is required for MAINBOARD",
        });
      }
    }

    if (row.category === ComponentCategory.PSU) {
      if (!row.wattage) {
        context.addIssue({
          code: "custom",
          path: ["wattage"],
          message: "wattage is required for PSU",
        });
      }
      if (!row.efficiencyRating) {
        context.addIssue({
          code: "custom",
          path: ["efficiencyRating"],
          message: "efficiencyRating is required for PSU",
        });
      }
      if (!row.modular) {
        context.addIssue({
          code: "custom",
          path: ["modular"],
          message: "modular is required for PSU",
        });
      }
    }

    if (row.category === ComponentCategory.CASE) {
      if (!row.caseSize) {
        context.addIssue({
          code: "custom",
          path: ["caseSize"],
          message: "caseSize is required for CASE",
        });
      }
      if (!row.supportedMainboard) {
        context.addIssue({
          code: "custom",
          path: ["supportedMainboard"],
          message: "supportedMainboard is required for CASE",
        });
      }
    }

    if (row.category === ComponentCategory.COOLER) {
      if (!row.coolerType) {
        context.addIssue({
          code: "custom",
          path: ["coolerType"],
          message: "coolerType is required for COOLER",
        });
      }
      if (!row.supportedSocket) {
        context.addIssue({
          code: "custom",
          path: ["supportedSocket"],
          message: "supportedSocket is required for COOLER",
        });
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

export const presignedPostRequestSchema = z.object({
  branchId: z.string().uuid(),
  fileName: z.string().trim().min(1).regex(/\.xlsx$/i, "Only .xlsx files are supported"),
  contentType: z.string().trim().default("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
});

export type PresignedPostRequest = z.infer<typeof presignedPostRequestSchema>;
