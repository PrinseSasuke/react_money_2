const { S3Client, PutObjectCommand, HeadBucketCommand } = require("@aws-sdk/client-s3");

// Photos of receipts in the S3 bucket (SeaweedFS locally). One attempt and a hard deadline per call:
// the API must answer 503 within 3 s when storage is down, not retry for a minute.
function createStorage({ s3, dependencyTimeoutMs }) {
  const client = new S3Client({
    endpoint: s3.endpoint,
    region: s3.region,
    forcePathStyle: true, // http://host:8333/receipts/key, not receipts.host
    credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
    maxAttempts: 1,
  });
  const opts = () => ({ abortSignal: AbortSignal.timeout(dependencyTimeoutMs) });

  return {
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: body, ContentType: contentType }), opts());
    },
    async ping() {
      await client.send(new HeadBucketCommand({ Bucket: s3.bucket }), opts());
    },
    close: () => client.destroy(),
  };
}

module.exports = { createStorage };
