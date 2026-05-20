import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { syncWindsorMappedAccounts } from "@/lib/integrations/windsor/sync";
import type { SyncResult, SyncSample } from "@/lib/integrations/windsor/sync";

export interface WindsorSyncApiResponse {
  success: boolean;
  totalFetched: number;
  mappedRecords: number;
  groupedRecords: number;
  skippedUnmapped: number;
  upserted: number;
  errors: number;
  datePreset: string;
  unmappedAccounts: string[];
  sampleSaved: SyncSample[];
  error?: string;
  errorDetail?: string;
}

function emptyBase(): Omit<WindsorSyncApiResponse, "success" | "error" | "errorDetail"> {
  return {
    totalFetched: 0,
    mappedRecords: 0,
    groupedRecords: 0,
    skippedUnmapped: 0,
    upserted: 0,
    errors: 0,
    datePreset: "last_7d",
    unmappedAccounts: [],
    sampleSaved: [],
  };
}

function err(message: string, status: number, detail?: string): Response {
  return NextResponse.json<WindsorSyncApiResponse>(
    { success: false, ...emptyBase(), error: message, ...(detail ? { errorDetail: detail } : {}) },
    { status }
  );
}

function toResponse(result: SyncResult): WindsorSyncApiResponse {
  return {
    success: result.success,
    totalFetched: result.totalFetched,
    mappedRecords: result.mappedRecords,
    groupedRecords: result.groupedRecords,
    skippedUnmapped: result.skippedUnmapped,
    upserted: result.upserted,
    errors: result.errors,
    datePreset: result.datePreset,
    unmappedAccounts: result.unmappedAccounts,
    sampleSaved: result.sampleSaved,
    ...(result.error ? { error: result.error } : {}),
    ...(result.errorDetail ? { errorDetail: result.errorDetail } : {}),
  };
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

  // ── Sincronização ─────────────────────────────────────────────
  const result = await syncWindsorMappedAccounts();

  return NextResponse.json<WindsorSyncApiResponse>(
    toResponse(result),
    { status: result.success ? 200 : 502 }
  );
}
