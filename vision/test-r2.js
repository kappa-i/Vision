import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const endpoint = "https://ba78ca0abe801a2bc5ca179dc455ce5c.r2.cloudflarestorage.com";
const accessKeyId = "7c6165049c9dfe1141fba6f0a3de2cf6";
const secretAccessKey = "65a8173ea574ea0f9c345c54a2ff8f408fb70247484ad255d034403c32a09bd7";
const bucket = "vision-storage";

const s3 = new S3Client({
  region: "auto",
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function testUpload() {
  console.log("Starting upload test to R2...");
  try {
    const data = await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "test-file.txt",
        Body: "Hello from Node.js!",
        ContentType: "text/plain",
      })
    );
    console.log("Upload successful:", data);
  } catch (err) {
    console.error("Upload failed:", err);
  }
}

testUpload();
