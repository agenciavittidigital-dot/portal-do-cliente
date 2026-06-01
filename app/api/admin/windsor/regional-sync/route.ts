import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { syncWindsorRegionalBreakdown } from "@/lib/integrations/windsor/regional-sync";
import type { RegionalSyncResult } from "@/lib/integrations/windsor/regional-sync";

export type WindsorRegionalSyncApiResponse = RegionalSyncResult;

function emptyBase(): Omit<WindsorRegionalSyncApiResponse, "success" | "error" | "errorDetail"> {
  return {
    totalFetched: 0,
    mappedRecords: 0,
    groupedRecords: 0,
    skippedUnmapped: 0,
    skippedNoRegion: 0,
    upserted: 0,
    errors: 0,
    datePreset: "last_7d",
    fieldsSynced: [],
    unmappedAccounts: [],
    sampleSaved: [],
  };
}

function err(message: string, status: number, detail?: string): Response {
  return NextResponse.json<WindsorRegionalSyncApiResponse>(
    { success: false, ...emptyBase(), error: message, ...(detail ? { errorDetail: detail } : {}) },
    { status }
  );
}

export async function POST(): Promise<Response> {
  // ── Autenticação ──────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return err("Não autenticado.", 401);

  // ── Autorização: somente vitti_admin ──────────────────────────
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return err("Acesso restrito a administradores Vitti.", 403);

  // ── Sincronização regional ────────────────────────────────────
  const result = await syncWindsorRegionalBreakdown();

  return NextResponse.json<WindsorRegionalSyncApiResponse>(result, {
    status: result.success ? 200 : 502,
  });
}
