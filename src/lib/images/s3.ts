import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { env } from "@/lib/config/env";

let client: S3Client | undefined;

/** True only when the bucket and both keys are configured. */
export function s3Enabled(): boolean {
  return !!(env.AWS_S3_BUCKET && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
}

function getClient(): S3Client {
  client ??= new S3Client({
    region: env.AWS_REGION,
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID!, secretAccessKey: env.AWS_SECRET_ACCESS_KEY! },
  });
  return client;
}

/** Uploads one image and returns its public URL (same URL shape the scrapper project stores). */
export async function uploadImageToS3(key: string, body: Buffer, contentType: string): Promise<string> {
  await new Upload({
    client: getClient(),
    params: { Bucket: env.AWS_S3_BUCKET!, Key: key, Body: body, ContentType: contentType, CacheControl: "max-age=31536000" },
  }).done();
  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}
