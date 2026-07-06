import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  uploadPortalFile,
  deletePortalFile,
  getSignedDownloadUrl,
} from "@/lib/storage/portal-files";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Não autenticado.", status: 401 };
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return { user, error: "Acesso restrito.", status: 403 };
  return { user, error: null, status: 200 };
}

// GET /api/admin/editorial/[id]/attachments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );

  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("editorial_attachments")
    .select("id, file_name, file_size, storage_path, uploaded_at, position")
    .eq("content_id", id)
    .order("position", { ascending: true })
    .order("uploaded_at", { ascending: true });

  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );

  const attachments = await Promise.all(
    (data ?? []).map(async (a) => {
      let url: string | null = null;
      try {
        url = await getSignedDownloadUrl(String(a.storage_path), 3600);
      } catch { /* ignore */ }
      return {
        id: String(a.id),
        fileName: String(a.file_name),
        fileSize: Number(a.file_size),
        storagePath: String(a.storage_path),
        uploadedAt: String(a.uploaded_at),
        url,
      };
    })
  );

  return NextResponse.json({ success: true, attachments });
}

// POST /api/admin/editorial/[id]/attachments
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );

  const { id } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Formulário inválido." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File))
    return NextResponse.json(
      { success: false, error: "Arquivo não encontrado." },
      { status: 400 }
    );

  // Block video files — use the video_url field instead
  const isVideo =
    file.type.startsWith("video/") ||
    /\.(mp4|mov|avi|mkv|wmv|flv|webm|m4v|mpg|mpeg)$/i.test(file.name);
  if (isVideo)
    return NextResponse.json(
      {
        success: false,
        error:
          'Upload de vídeo não permitido. Use o campo "Link do vídeo" para adicionar o link.',
      },
      { status: 400 }
    );

  const position = parseInt(String(formData.get("position") ?? "0"), 10) || 0;

  let uploaded: { filePath: string; fileName: string; fileSize: number };
  try {
    const result = await uploadPortalFile(file, `editorial/${id}`);
    uploaded = {
      filePath: result.filePath,
      fileName: result.fileName,
      fileSize: result.fileSize,
    };
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Falha no upload.", detail: String(err) },
      { status: 500 }
    );
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", auth.user!.id)
    .maybeSingle();

  const { data: attachment, error: dbError } = await admin
    .from("editorial_attachments")
    .insert({
      content_id: id,
      storage_path: uploaded.filePath,
      file_name: uploaded.fileName,
      file_size: uploaded.fileSize,
      uploaded_by: profile?.id ?? null,
      position,
    })
    .select("id, file_name, file_size, storage_path, uploaded_at")
    .single();

  if (dbError || !attachment) {
    await deletePortalFile(uploaded.filePath).catch(() => {});
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao registrar anexo.",
        detail: dbError?.message,
      },
      { status: 500 }
    );
  }

  let url: string | null = null;
  try {
    url = await getSignedDownloadUrl(String(attachment.storage_path), 3600);
  } catch { /* ignore */ }

  return NextResponse.json({
    success: true,
    attachment: {
      id: String(attachment.id),
      fileName: String(attachment.file_name),
      fileSize: Number(attachment.file_size),
      storagePath: String(attachment.storage_path),
      uploadedAt: String(attachment.uploaded_at),
      url,
    },
  });
}

// DELETE /api/admin/editorial/[id]/attachments?attachmentId=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );

  const { id } = await params;
  const attachmentId = req.nextUrl.searchParams.get("attachmentId");
  if (!attachmentId)
    return NextResponse.json(
      { success: false, error: "attachmentId obrigatório." },
      { status: 400 }
    );

  const admin = createAdminClient();

  const { data: attachment, error: fetchError } = await admin
    .from("editorial_attachments")
    .select("id, storage_path")
    .eq("id", attachmentId)
    .eq("content_id", id)
    .maybeSingle();

  if (fetchError || !attachment)
    return NextResponse.json(
      { success: false, error: "Anexo não encontrado." },
      { status: 404 }
    );

  const { error: deleteError } = await admin
    .from("editorial_attachments")
    .delete()
    .eq("id", attachmentId);

  if (deleteError)
    return NextResponse.json(
      { success: false, error: "Erro ao remover anexo." },
      { status: 500 }
    );

  await deletePortalFile(String(attachment.storage_path)).catch(() => {});

  return NextResponse.json({ success: true });
}
