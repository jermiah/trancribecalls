import { upload } from "@vercel/blob/client";

/**
 * Sanitize filenames for Vercel Blob. Special characters like [ ] and spaces
 * in the pathname cause "Failed to retrieve the client token" errors because
 * Blob uses the name as part of the signed URL path.
 */
function safeBlobName(originalName: string): string {
  return originalName
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_()\-.,]/g, "_");
}

/**
 * Uploads a file directly to Vercel Blob (bypasses the 4.5 MB Functions body limit).
 * The sanitized name is used for the Blob path; the original filename is kept
 * in the job record and used as the heading in the Word document.
 */
export async function uploadFileToBlob(file: File): Promise<{ url: string }> {
  const blobName = safeBlobName(file.name);
  const blob = await upload(blobName, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
  });
  return { url: blob.url };
}
