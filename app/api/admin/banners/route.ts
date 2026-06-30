import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { listBanners, createBanner } from "@/lib/data/banners-admin";
import type { BannerRow } from "@/lib/data/banners-admin";
import { uploadPortalFile } from "@/lib/storage/portal-files";

export interface BannerListResponse {
  success: boolean;
  banners?: BannerRow[];
  error?: string;
}

export interface BannerCreateResponse {
  success: boolean;
  banner?: BannerRow;
  error?: string;
  detail?: string;
}

async function requireAdmin(): Promise<{ ok: true } | { error: Response }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { error: NextResponse.json<BannerListResponse>({ success: false, error: "Não autenticado." }, { status: 401 }) };
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin)
    return { error: NextResponse.json<BannerListResponse>({ success: false, error: "Acesso restrito a administradores Vitti." }, { status: 403 }) };
  return { ok: true };
}

// GET /api/admin/banners
export async function GET(): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const banners = await listBanners();
    return NextResponse.json<BannerListResponse>({ success: true, banners });
  } catch (err) {
    return NextResponse.json<BannerListResponse>(
      { success: false, error: err instanceof Error ? err.message : "Erro ao listar banners." },
      { status: 500 }
    );
  }
}

// POST /api/admin/banners — multipart/form-data
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json<BannerCreateResponse>({ success: false, error: "Formulário inválido." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json<BannerCreateResponse>({ success: false, error: "Imagem é obrigatória." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json<BannerCreateResponse>({ success: false, error: "O arquivo deve ser uma imagem." }, { status: 400 });
  }

  const rawLink = formData.get("linkUrl");
  const linkUrl = typeof rawLink === "string" && rawLink.trim() ? rawLink.trim() : null;

  const rawOrder = formData.get("sortOrder");
  const sortOrder = rawOrder ? parseInt(String(rawOrder), 10) : 0;

  const rawActive = formData.get("isActive");
  const isActive = rawActive !== "false";

  let uploaded: Awaited<ReturnType<typeof uploadPortalFile>>;
  try {
    uploaded = await uploadPortalFile(file, "banners");
  } catch (err) {
    return NextResponse.json<BannerCreateResponse>(
      { success: false, error: "Falha ao enviar imagem.", detail: err instanceof Error ? err.message : undefined },
      { status: 500 }
    );
  }

  try {
    const banner = await createBanner({
      storagePath: uploaded.filePath,
      linkUrl,
      sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
      isActive,
    });
    return NextResponse.json<BannerCreateResponse>({ success: true, banner }, { status: 201 });
  } catch (err) {
    const { deletePortalFile } = await import("@/lib/storage/portal-files");
    await deletePortalFile(uploaded.filePath).catch(() => {});
    return NextResponse.json<BannerCreateResponse>(
      { success: false, error: "Erro ao salvar banner.", detail: err instanceof Error ? err.message : undefined },
      { status: 500 }
    );
  }
}
