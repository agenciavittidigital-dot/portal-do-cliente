import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { syncWindsorDemographicBreakdown } from "@/lib/integrations/windsor/demographic-sync";
import type { DemographicSyncResult } from "@/lib/integrations/windsor/demographic-sync";

export type WindsorDemographicSyncApiResponse = DemographicSyncResult;

function emptyBase(): Omit<WindsorDemographicSyncApiResponse, "success" | "error" | "errorDetail"> {
  return {
    totalFetched: 0,
    genderRecords: 0,
    ageRecords: 0,
    upserted: 0,
    skippedUnmapped: 0,
    unmappedAccounts: [],
  };
}

function err(message: string, status: number, detail?: string): Response {
  return NextResponse.json<WindsorDemographicSyncApiResponse>(
    {
      success: false,
      ...emptyBase(),
      error: message,
      ...(detail ? { errorDetail: detail } : {}),
    },
    { status }
  );
}

export async function POST(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return err("Não autenticado.", 401);

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return err("Acesso restrito a administradores Vitti.", 403);

  const result = await syncWindsorDemographicBreakdown();

  return NextResponse.json<WindsorDemographicSyncApiResponse>(result, {
    status: result.success ? 200 : 502,
  });
}
