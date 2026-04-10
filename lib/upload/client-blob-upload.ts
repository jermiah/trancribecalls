import { upload } from "@vercel/blob/client";

/**
 * Uploads a file directly to Vercel Blob (bypasses the 4.5 MB Functions body limit).
 */
export async function uploadFileToBlob(file: File): Promise<{ url: string }> {
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
  });
  return { url: blob.url };
}
