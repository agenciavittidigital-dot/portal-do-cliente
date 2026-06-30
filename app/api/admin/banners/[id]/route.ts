import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { updateBanner, deleteBanner } from "@/lib/data/banners-admin";
import type { BannerRow } from "@/lib/data/banners-admin";
import { uploadPortalFile, deletePortalFile } from "@/lib/storage/portal-files";

export interface BannerPatchResponse {
  success: boolean;
  banner?: BannerRow;
  error?: string;
  detail?: string;
}

export interface BannerDeleteResponse {
  success: boolean;
  error?: string;
}

async function requireAdmin(): Promise<{ ok: true } | { error: Response }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { error: NextResponse.json<BannerPatchResponse>({ success: false, error: "Não autenticado." }, { status: 401 }) };
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin)
    return { error: NextResponse.json<BannerPatchResponse>({ success: false, error: "Acesso restrito a administradores Vitti." }, { status: 403 }) };
  return { ok: true };
}

// PATCH /api/admin/banners/[id] — multipart/form-data (file optional)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json<BannerPatchResponse>({ success: false, error: "Formulário inválido." }, { status: 400 });
  }

  const patch: Parameters<typeof updateBanner>[1] = {};

  const rawLink = formData.get("linkUrl");
  if (rawLink !== null) {
    patch.linkUrl = typeof rawLink === "string" && rawLink.trim() ? rawLink.trim() : null;
  }

  const rawOrder = formData.get("sortOrder");
  if (rawOrder !== null) {
    const n = parseInt(String(rawOrder), 10);
    patch.sortOrder = isNaN(n) ? 0 : n;
  }

  const rawActive = formData.get("isActive");
  if (rawActive !== null) {
    patch.isActive = rawActive !== "false";
  }

  // Optional new image
  const file = formData.get("file");
  let oldPath: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json<BannerPatchResponse>({ success: false, error: "O arquivo deve ser uma imagem." }, { status: 400 });
    }
    // Grab old storage path before overwriting (passed by client)
    const rawOldPath = formData.get("oldStoragePath");
    if (typeof rawOldPath === "string" && rawOldPath.trim()) {
      oldPath = rawOldPath.trim();
    }

    let uploaded: Awaited<ReturnType<typeof uploadPortalFile>>;
    try {
      uploaded = await uploadPortalFile(file, "banners");
    } catch (err) {
      return NextResponse.json<BannerPatchResponse>(
        { success: false, error: "Falha ao enviar imagem.", detail: err instanceof Error ? err.message : undefined },
        { status: 500 }
      );
    }
    patch.storagePath = uploaded.filePath;
  }

  try {
    const banner = await updateBanner(id, patch);
    // Remove old image from storage after successful DB update
    if (oldPath) {
      await deletePortalFile(oldPath).catch(() => {});
    }
    return NextResponse.json<BannerPatchResponse>({ success: true, banner });
  } catch (err) {
    // Rollback new upload if DB fails
    if (patch.storagePath) {
      await deletePortalFile(patch.storagePath).catch(() => {});
    }
    return NextResponse.json<BannerPatchResponse>(
      { success: false, error: "Erro ao atualizar banner.", detail: err instanceof Error ? err.message : undefined },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/banners/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const storagePath = await deleteBanner(id);
    if (storagePath) {
      await deletePortalFile(storagePath).catch(() => {});
    }
    return NextResponse.json<BannerDeleteResponse>({ success: true });
  } catch (err) {
    return NextResponse.json<BannerDeleteResponse>(
      { success: false, error: err instanceof Error ? err.message : "Erro ao excluir banner." },
      { status: 500 }
    );
  }
}
