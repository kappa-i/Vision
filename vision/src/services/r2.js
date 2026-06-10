import { readFile } from "@tauri-apps/plugin-fs";
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { basename } from "./files";

const endpoint = import.meta.env.VITE_R2_ENDPOINT;
const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY;
const secretAccessKey = import.meta.env.VITE_R2_SECRET_KEY;
const bucket = import.meta.env.VITE_R2_BUCKET;
// Optionnel: URL publique si configurée dans Cloudflare (ex: https://pub-xxx.r2.dev)
const publicDomain = import.meta.env.VITE_R2_PUBLIC_DOMAIN || "";

let s3 = null;
if (endpoint && accessKeyId) {
  s3 = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function uploadToR2(localPath, folder = "media") {
  if (!s3 || !localPath) return null;
  if (/^https?:\/\//.test(localPath)) return null;

  try {
    const fileData = await readFile(localPath);
    const fileName = `${Date.now()}-${basename(localPath).replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const key = `${folder}/${fileName}`;

    let contentType = "image/jpeg";
    if (fileName.toLowerCase().endsWith(".png")) contentType = "image/png";
    if (fileName.toLowerCase().endsWith(".webp")) contentType = "image/webp";
    if (fileName.toLowerCase().endsWith(".gif")) contentType = "image/gif";

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileData,
      ContentType: contentType,
    });

    await s3.send(command);
    
    // Si on a un domaine public configuré, on retourne l'URL directe,
    // sinon on retourne l'URL endpoint (qui nécessitera des permissions)
    if (publicDomain) {
      return `${publicDomain}/${key}`;
    }
    
    // Fallback: retourne une URL formatée (nécessitera un bucket public ou presigned URL)
    return `https://${bucket}.${new URL(endpoint).host}/${key}`;

  } catch (error) {
    console.error("Erreur upload R2:", error);
    return null;
  }
}

export async function deleteFromR2(url) {
  if (!s3 || !url || !url.startsWith("http")) return false;

  try {
    // Extraire la clé (le chemin après le domaine)
    let key = "";
    if (publicDomain && url.startsWith(publicDomain)) {
      key = url.replace(`${publicDomain}/`, "");
    } else {
      const urlObj = new URL(url);
      key = urlObj.pathname.substring(1); // Enlever le premier '/'
    }

    if (!key) return false;

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3.send(command);
    return true;
  } catch (error) {
    console.error("Erreur suppression R2:", error);
    return false;
  }
}

export async function deleteFolderFromR2(folderPrefix) {
  if (!s3 || !folderPrefix) return false;
  try {
    const listCmd = new ListObjectsV2Command({ Bucket: bucket, Prefix: folderPrefix });
    const listRes = await s3.send(listCmd);
    if (!listRes.Contents || listRes.Contents.length === 0) return true;

    for (const item of listRes.Contents) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: item.Key }));
    }
    return true;
  } catch (e) {
    console.error("Erreur suppression dossier R2:", e);
    return false;
  }
}
