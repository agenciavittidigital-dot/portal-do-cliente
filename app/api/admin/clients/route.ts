import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import {
  listAdminClients,
  createAdminClient,
  slugifyName,
} from "@/lib/data/clients-admin";
import type { AdminClientRow } from "@/lib/data/clients-admin";

// ── Shared response types ─────────────────────────────────────────────────────

export interface ClientsListResponse {
  success: boolean;
  clients: AdminClientRow[];
  error?: string;
}

export interface ClientCreateResponse {
  success: boolean;
  id?: string;
  error?: string;
  detail?: string;
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<
  { userId: string } | { error: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json<ClientCreateResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<ClientCreateResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }

  return { userId: user.id };
}

// ── GET /api/admin/clients ────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const clients = await listAdminClients();
  return NextResponse.json<ClientsListResponse>({ success: true, clients });
}

// ── POST /api/admin/clients ───────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ClientCreateResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const { name, slug, segment, status } = body as Record<string, unknown>;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json<ClientCreateResponse>(
      { success: false, error: "Nome é obrigatório." },
      { status: 400 }
    );
  }

  const finalSlug =
    slug && typeof slug === "string" && slug.trim()
      ? slugifyName(slug)
      : slugifyName(name as string);

  if (!finalSlug) {
    return NextResponse.json<ClientCreateResponse>(
      { success: false, error: "Slug inválido." },
      { status: 400 }
    );
  }

  const result = await createAdminClient({
    name: name.trim(),
    slug: finalSlug,
    segment: segment && typeof segment === "string" ? segment.trim() || null : null,
    status: status === "inactive" ? "inactive" : "active",
  });

  if ("error" in result) {
    return NextResponse.json<ClientCreateResponse>(
      { success: false, error: result.error, detail: result.detail },
      { status: 409 }
    );
  }

  return NextResponse.json<ClientCreateResponse>(
    { success: true, id: result.id },
    { status: 201 }
  );
}
