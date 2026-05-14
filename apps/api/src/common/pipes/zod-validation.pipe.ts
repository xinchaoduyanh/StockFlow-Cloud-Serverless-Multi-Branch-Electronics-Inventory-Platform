import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { z, ZodType } from "zod";
import { ApiErrors } from "../errors/api-error";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!this.schema) {
      return value;
    }

    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw ApiErrors.badRequest(`Invalid ${metadata.type}`, {
        issues: z.treeifyError(result.error),
      });
    }

    return result.data;
  }
}
