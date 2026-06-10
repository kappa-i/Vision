import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

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

async function listFiles() {
  console.log("Listing objects in R2 bucket...");
  try {
    const data = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
      })
    );
    if (data.Contents) {
      console.log(`Found ${data.Contents.length} objects:`);
      data.Contents.forEach(obj => {
        console.log(`- ${obj.Key} (${obj.Size} bytes)`);
      });
    } else {
      console.log("Bucket is empty.");
    }
  } catch (err) {
    console.error("List failed:", err);
  }
}

listFiles();
