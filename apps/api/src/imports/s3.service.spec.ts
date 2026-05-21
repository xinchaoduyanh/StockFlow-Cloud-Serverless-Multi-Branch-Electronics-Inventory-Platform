import { Test } from "@nestjs/testing";
import { S3Service } from "./s3.service";
import { EnvService } from "../config/env.service";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

jest.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: jest.fn().mockResolvedValue({
    url: "https://stockflow-imports-dev.s3.ap-southeast-1.amazonaws.com",
    fields: {
      key: "imports/uuid/job-fileName.xlsx",
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  }),
}));

describe("S3Service", () => {
  let s3Service: S3Service;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: EnvService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "AWS_REGION") return "ap-southeast-1";
              if (key === "AWS_S3_BUCKET") return "stockflow-imports-dev";
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    s3Service = moduleRef.get<S3Service>(S3Service);
  });

  it("should generate a presigned POST payload successfully", async () => {
    const key = "imports/test-branch-id/test-job-id-file.xlsx";
    const contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const result = await s3Service.generatePresignedPost(key, contentType);

    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("fields");
    expect(result.fields.key).toBe("imports/uuid/job-fileName.xlsx");
    expect(createPresignedPost).toHaveBeenCalled();
  });
});
