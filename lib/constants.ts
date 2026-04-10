/** MIME types we accept for uploads (plus extension checks on client). */
export const ALLOWED_UPLOAD_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "video/mp4",
] as const;

export const ALLOWED_EXTENSIONS = [".mp3", ".mp4"] as const;

export function isAllowedAudioVideoFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const extOk = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const mime = (file.type || "").toLowerCase();
  const mimeOk =
    ALLOWED_UPLOAD_MIME.includes(mime as (typeof ALLOWED_UPLOAD_MIME)[number]) ||
    mime === "" ||
    mime === "application/octet-stream";
  return extOk && mimeOk;
}
