import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

const BUCKET = "portal-files";

export interface StorageUploadResult {
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export async function uploadPortalFile(
  file: File,
  folder: string
): Promise<StorageUploadResult> {
  const admin = mkAdmin();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${folder}/${Date.now()}-${safeFileName}`;

  const buffer = await file.arrayBuffer();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    console.error("[uploadPortalFile] Supabase Storage error:", error.message);
    throw new Error(error.message);
  }

  return {
    filePath,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

export async function getSignedDownloadUrl(
  filePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const admin = mkAdmin();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Falha ao gerar URL assinada.");
  }
  return data.signedUrl;
}

// Removes a previously uploaded file. Used for orphan cleanup when a DB insert
// fails after the Storage upload already succeeded.
export async function deletePortalFile(filePath: string): Promise<void> {
  const admin = mkAdmin();
  const { error } = await admin.storage.from(BUCKET).remove([filePath]);
  if (error) {
    console.error("[deletePortalFile] Falha ao remover arquivo órfão:", error.message);
  }
}
