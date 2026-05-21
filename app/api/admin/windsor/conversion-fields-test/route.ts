import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { testWindsorConversionFields } from "@/lib/integrations/windsor/conversion-fields-test";
import type {
  ConversionTestResult,
  DatePreset,
  WindsorEndpoint,
} from "@/lib/integrations/windsor/conversion-fields-types";

export type ConversionTestApiResponse = ConversionTestResult;

const VALID_DATE_PRESETS: DatePreset[] = ["last_7d", "last_14d", "last_30d", "last_90d"];
const VALID_ENDPOINTS: WindsorEndpoint[] = ["all", "facebook"];

function err(message: string, status: number): Response {
  const body: ConversionTestApiResponse = {
    success: false,
    testedAt: new Date().toISOString(),
    endpoint: "all",
    datePreset: "last_7d",
    totalFetched: 0,
    fieldsAccepted: [],
    fieldsRejected: [],
    fieldsWithValues: [],
    fieldsWithData: [],
    results: [],
    sampleRows: [],
    error: message,
  };
  return NextResponse.json<ConversionTestApiResponse>(body, { status });
}

export async function GET(req: NextRequest): Promise<Response> {
  // ── Autenticação ──────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return err("Não autenticado.", 401);

  // ── Autorização: somente vitti_admin ──────────────────────────
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return err("Acesso restrito a administradores Vitti.", 403);

  // ── Parâmetros de diagnóstico ─────────────────────────────────
  const { searchParams } = new URL(req.url);

  const datePresetParam = searchParams.get("datePreset") ?? "last_7d";
  const endpointParam = searchParams.get("endpoint") ?? "all";

  const datePreset: DatePreset = VALID_DATE_PRESETS.includes(datePresetParam as DatePreset)
    ? (datePresetParam as DatePreset)
    : "last_7d";

  const endpoint: WindsorEndpoint = VALID_ENDPOINTS.includes(endpointParam as WindsorEndpoint)
    ? (endpointParam as WindsorEndpoint)
    : "all";

  // ── Diagnóstico — nunca salva no banco ───────────────────────
  const result = await testWindsorConversionFields({ datePreset, endpoint });

  return NextResponse.json<ConversionTestApiResponse>(result, {
    status: result.success ? 200 : 502,
  });
}
