import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const endpoint = "https://ba78ca0abe801a2bc5ca179dc455ce5c.r2.cloudflarestorage.com";
const accessKeyId = "7c6165049c9dfe1141fba6f0a3de2cf6";
const secretAccessKey = "65a8173ea574ea0f9c345c54a2ff8f408fb70247484ad255d034403c32a09bd7";
const bucket = "vision-storage";

const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function run() {
  try {
    console.log("Listing objects...");
    const listResult = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
    console.log("Files:", listResult.Contents?.map(c => c.Key) || "No files");
    
    if (listResult.Contents && listResult.Contents.length > 0) {
      const firstFile = listResult.Contents[0].Key;
      console.log("Testing delete on:", firstFile);
      const delResult = await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: firstFile }));
      console.log("Delete success:", delResult);
    }
  } catch(e) {
    console.error("Error:", e);
  }
}
run();
