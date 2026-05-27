import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { probeMetaRawData } from "@/lib/integrations/windsor/meta-raw-probe";
import type { MetaRawProbeResult } from "@/lib/integrations/windsor/meta-raw-probe";

export type MetaRawProbeApiResponse = MetaRawProbeResult;

const VALID_PRESETS = ["last_7d", "last_14d", "last_30d", "last_90d"] as const;
type DatePreset = (typeof VALID_PRESETS)[number];

function errRes(message: string, status: number): Response {
  const body: MetaRawProbeApiResponse = {
    success: false,
    testedAt: new Date().toISOString(),
    datePreset: "last_30d",
    endpoint: "/all",
    totalRecords: 0,
    demoRecords: 0,
    realRecords: 0,
    realAccountNames: [],
    fieldsWithRealValues: [],
    fieldsWithRealData: [],
    fieldCoverage: [],
    categorySummary: [],
    sampleRealRecords: [],
    error: message,
  };
  return NextResponse.json<MetaRawProbeApiResponse>(body, { status });
}

export async function GET(req: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return errRes("Não autenticado.", 401);

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return errRes("Acesso restrito a administradores Vitti.", 403);

  const { searchParams } = new URL(req.url);
  const presetParam = searchParams.get("datePreset") ?? "last_30d";
  const datePreset: DatePreset = (VALID_PRESETS as readonly string[]).includes(presetParam)
    ? (presetParam as DatePreset)
    : "last_30d";

  const result = await probeMetaRawData(datePreset);

  return NextResponse.json<MetaRawProbeApiResponse>(result, {
    status: result.success ? 200 : 502,
  });
}
