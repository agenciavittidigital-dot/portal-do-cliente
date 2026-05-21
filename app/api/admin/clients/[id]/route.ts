import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { updateAdminClient, slugifyName } from "@/lib/data/clients-admin";

export interface ClientUpdateResponse {
  success: boolean;
  error?: string;
  detail?: string;
}

async function requireAdmin(): Promise<
  { userId: string } | { error: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json<ClientUpdateResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<ClientUpdateResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }

  return { userId: user.id };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  if (!id) {
    return NextResponse.json<ClientUpdateResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ClientUpdateResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const { name, slug, segment, status } = body as Record<string, unknown>;

  const patch: Parameters<typeof updateAdminClient>[1] = {};

  if (name !== undefined && typeof name === "string") {
    if (!name.trim()) {
      return NextResponse.json<ClientUpdateResponse>(
        { success: false, error: "Nome não pode ser vazio." },
        { status: 400 }
      );
    }
    patch.name = name.trim();
  }

  if (slug !== undefined && typeof slug === "string") {
    const s = slugifyName(slug);
    if (!s) {
      return NextResponse.json<ClientUpdateResponse>(
        { success: false, error: "Slug inválido." },
        { status: 400 }
      );
    }
    patch.slug = s;
  }

  if ("segment" in (body as object)) {
    patch.segment =
      segment && typeof segment === "string" ? segment.trim() || null : null;
  }

  if (status === "active" || status === "inactive") {
    patch.status = status;
  }

  const result = await updateAdminClient(id, patch);

  if ("error" in result) {
    return NextResponse.json<ClientUpdateResponse>(
      { success: false, error: result.error, detail: result.detail },
      { status: 409 }
    );
  }

  return NextResponse.json<ClientUpdateResponse>({ success: true });
}
