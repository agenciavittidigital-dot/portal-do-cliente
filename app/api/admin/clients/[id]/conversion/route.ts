import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ConversionPatchResponse {
  success: boolean;
  error?: string;
  detail?: string;
}

const VALID_METRICS = ["leads", "messages", "purchases"] as const;
type ConversionMetric = (typeof VALID_METRICS)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json<ConversionPatchResponse>(
      { success: false, error: "Não autenticado." },
      { status: 401 }
    );
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return NextResponse.json<ConversionPatchResponse>(
      { success: false, error: "Acesso restrito a administradores Vitti." },
      { status: 403 }
    );
  }

  const { id: clientId } = await params;
  if (!clientId) {
    return NextResponse.json<ConversionPatchResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ConversionPatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const metric = b.conversion_metric as ConversionMetric | undefined;
  if (!metric || !VALID_METRICS.includes(metric)) {
    return NextResponse.json<ConversionPatchResponse>(
      { success: false, error: "Valor inválido. Use 'leads', 'messages' ou 'purchases'." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: dashboards, error: dashErr } = await admin
    .from("client_dashboards")
    .select("id")
    .eq("client_id", clientId);

  if (dashErr) {
    return NextResponse.json<ConversionPatchResponse>(
      { success: false, error: "Erro ao buscar dashboards.", detail: dashErr.message },
      { status: 500 }
    );
  }

  if (!dashboards?.length) {
    return NextResponse.json<ConversionPatchResponse>(
      { success: false, error: "Nenhum dashboard encontrado. Crie o dashboard antes de configurar a conversão." },
      { status: 404 }
    );
  }

  const dashIds = dashboards.map((d) => String(d.id));

  const { data: blocks, error: blockErr } = await admin
    .from("dashboard_blocks")
    .select("id, settings")
    .in("dashboard_id", dashIds);

  if (blockErr) {
    return NextResponse.json<ConversionPatchResponse>(
      { success: false, error: "Erro ao buscar blocos.", detail: blockErr.message },
      { status: 500 }
    );
  }

  if (!blocks?.length) {
    return NextResponse.json<ConversionPatchResponse>(
      { success: false, error: "Nenhum bloco encontrado. Garanta o dashboard antes de configurar a conversão." },
      { status: 404 }
    );
  }

  await Promise.all(
    blocks.map((block) => {
      const existing = (block.settings as Record<string, unknown> | null) ?? {};
      return admin
        .from("dashboard_blocks")
        .update({ settings: { ...existing, conversion_metric: metric } })
        .eq("id", block.id);
    })
  );

  return NextResponse.json<ConversionPatchResponse>({ success: true });
}
