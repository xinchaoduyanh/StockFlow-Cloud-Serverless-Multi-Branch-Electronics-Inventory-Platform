import { Injectable } from "@nestjs/common";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { EnvService } from "../config/env.service";
import { staticAwsCredentials } from "../config/aws-credentials";

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;

  constructor(private readonly envService: EnvService) {
    const region = this.envService.get("AWS_REGION");
    const endpoint = this.envService.get("AWS_S3_ENDPOINT");

    this.s3Client = new S3Client({
      region,
      credentials: staticAwsCredentials(this.envService),
      endpoint: endpoint || undefined,
      forcePathStyle: endpoint ? true : undefined,
    });
  }

  async generatePresignedPost(key: string, contentType: string) {
    const bucket = this.envService.get("AWS_S3_BUCKET");

    return createPresignedPost(this.s3Client, {
      Bucket: bucket,
      Key: key,
      Conditions: [
        [
          "starts-with",
          "$Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        ["content-length-range", 1024, 10485760], // Limit file size between 1KB and 10MB
      ],
      Fields: {
        "Content-Type": contentType,
      },
      Expires: 600, // 10 minutes expiry
    });
  }
}
