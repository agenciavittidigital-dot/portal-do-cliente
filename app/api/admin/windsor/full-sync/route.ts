import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { syncWindsorMappedAccounts } from "@/lib/integrations/windsor/sync";
import { syncGoogleAdsMappedAccounts } from "@/lib/integrations/windsor/google-ads-sync";
import { syncWindsorDemographicBreakdown } from "@/lib/integrations/windsor/demographic-sync";
import { syncWindsorRegionalBreakdown } from "@/lib/integrations/windsor/regional-sync";
import { syncGoogleAdsKeywords } from "@/lib/integrations/windsor/google-ads-keywords-sync";
import type { SyncResult } from "@/lib/integrations/windsor/sync";
import type { GoogleAdsSyncResult } from "@/lib/integrations/windsor/google-ads-sync";
import type { DemographicSyncResult } from "@/lib/integrations/windsor/demographic-sync";
import type { RegionalSyncResult } from "@/lib/integrations/windsor/regional-sync";
import type { KeywordsSyncResult } from "@/lib/integrations/windsor/google-ads-keywords-sync";

// Permite até 300s no Vercel Pro — suficiente para 5 syncs paralelos com janela de 30 dias.
export const maxDuration = 300;

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ProcessResult {
  success: boolean;
  upserted: number;
  error?: string;
  errorDetail?: string;
}

export interface FullSyncApiResponse {
  // true somente se TODOS os 5 processos forem bem-sucedidos
  success: boolean;
  // true se ao menos 1 processo falhou mas outros completaram
  partialSuccess: boolean;
  executedAt: string;
  dateRange: string;
  meta: ProcessResult & { mappedRecords: number; datePreset: string };
  googleAds: ProcessResult & { mappedRecords: number; datePreset: string };
  demographic: ProcessResult & { genderRecords: number; ageRecords: number };
  regional: ProcessResult & { mappedRecords: number; datePreset: string };
  keywords: ProcessResult & { rowsUpserted: number };
  error?: string;
}

// ── Fallbacks ─────────────────────────────────────────────────────────────────

function metaFallback(cause: unknown): SyncResult {
  return {
    success: false,
    totalFetched: 0,
    mappedRecords: 0,
    groupedRecords: 0,
    skippedUnmapped: 0,
    upserted: 0,
    errors: 1,
    datePreset: "",
    fieldsSynced: [],
    unmappedAccounts: [],
    sampleSaved: [],
    error: cause instanceof Error ? cause.message : "Erro inesperado no sync Meta Ads.",
  };
}

function googleAdsFallback(cause: unknown): GoogleAdsSyncResult {
  return {
    success: false,
    totalFetched: 0,
    googleAdsRecords: 0,
    mappedRecords: 0,
    groupedRecords: 0,
    skippedUnmapped: 0,
    upserted: 0,
    errors: 1,
    datePreset: "",
    fieldsSynced: [],
    unmappedAccounts: [],
    sampleSaved: [],
    error: cause instanceof Error ? cause.message : "Erro inesperado no sync Google Ads.",
  };
}

function demographicFallback(cause: unknown): DemographicSyncResult {
  return {
    success: false,
    totalFetched: 0,
    genderRecords: 0,
    ageRecords: 0,
    upserted: 0,
    skippedUnmapped: 0,
    unmappedAccounts: [],
    error: cause instanceof Error ? cause.message : "Erro inesperado no sync demográfico.",
  };
}

function regionalFallback(cause: unknown): RegionalSyncResult {
  return {
    success: false,
    totalFetched: 0,
    mappedRecords: 0,
    groupedRecords: 0,
    skippedUnmapped: 0,
    skippedNoRegion: 0,
    upserted: 0,
    errors: 1,
    datePreset: "",
    fieldsSynced: [],
    unmappedAccounts: [],
    sampleSaved: [],
    error: cause instanceof Error ? cause.message : "Erro inesperado no sync regional.",
  };
}

function keywordsFallback(cause: unknown): KeywordsSyncResult {
  return {
    success: false,
    rowsFetched: 0,
    googleAdsRows: 0,
    rowsSkipped: 0,
    rowsUpserted: 0,
    integrationsMatched: 0,
    dateRange: "",
    syncedAt: new Date().toISOString(),
    error: cause instanceof Error ? cause.message : "Erro inesperado no sync de palavras-chave.",
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json<FullSyncApiResponse>(
      {
        success: false,
        partialSuccess: false,
        executedAt: new Date().toISOString(),
        dateRange: "",
        meta: { success: false, upserted: 0, mappedRecords: 0, datePreset: "", error: "Não autenticado." },
        googleAds: { success: false, upserted: 0, mappedRecords: 0, datePreset: "", error: "Não autenticado." },
        demographic: { success: false, upserted: 0, genderRecords: 0, ageRecords: 0, error: "Não autenticado." },
        regional: { success: false, upserted: 0, mappedRecords: 0, datePreset: "", error: "Não autenticado." },
        keywords: { success: false, upserted: 0, rowsUpserted: 0, error: "Não autenticado." },
        error: "Não autenticado.",
      },
      { status: 401 }
    );
  }

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return NextResponse.json<FullSyncApiResponse>(
      {
        success: false,
        partialSuccess: false,
        executedAt: new Date().toISOString(),
        dateRange: "",
        meta: { success: false, upserted: 0, mappedRecords: 0, datePreset: "", error: "Acesso restrito." },
        googleAds: { success: false, upserted: 0, mappedRecords: 0, datePreset: "", error: "Acesso restrito." },
        demographic: { success: false, upserted: 0, genderRecords: 0, ageRecords: 0, error: "Acesso restrito." },
        regional: { success: false, upserted: 0, mappedRecords: 0, datePreset: "", error: "Acesso restrito." },
        keywords: { success: false, upserted: 0, rowsUpserted: 0, error: "Acesso restrito." },
        error: "Acesso restrito a administradores Vitti.",
      },
      { status: 403 }
    );
  }

  // Janela de 30 dias — data final calculada em America/Sao_Paulo.
  // Intl.DateTimeFormat com sv-SE retorna "YYYY-MM-DD" e respeita DST (não usa offset fixo -3h).
  const dateTo = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const [y, m, d] = dateTo.split("-").map(Number);
  const dateFrom = new Date(Date.UTC(y, m - 1, d - 29)).toISOString().slice(0, 10);

  const dateRange = `${dateFrom}/${dateTo}`;
  const executedAt = new Date().toISOString();

  // Todos os 5 processos em paralelo.
  // Promise.allSettled garante que uma falha não cancela os demais.
  const [metaS, googleS, demographicS, regionalS, keywordsS] = await Promise.allSettled([
    syncWindsorMappedAccounts({ dateFrom, dateTo }),
    syncGoogleAdsMappedAccounts({ dateFrom, dateTo }),
    syncWindsorDemographicBreakdown(),  // já usa 30 dias internamente
    syncWindsorRegionalBreakdown({ dateFrom, dateTo }),
    syncGoogleAdsKeywords(dateFrom, dateTo),
  ]);

  const meta   = metaS.status        === "fulfilled" ? metaS.value        : metaFallback(metaS.reason);
  const google = googleS.status      === "fulfilled" ? googleS.value      : googleAdsFallback(googleS.reason);
  const demo   = demographicS.status === "fulfilled" ? demographicS.value : demographicFallback(demographicS.reason);
  const reg    = regionalS.status    === "fulfilled" ? regionalS.value    : regionalFallback(regionalS.reason);
  const kw     = keywordsS.status    === "fulfilled" ? keywordsS.value    : keywordsFallback(keywordsS.reason);

  const allSuccess = meta.success && google.success && demo.success && reg.success && kw.success;
  const anySuccess = meta.success || google.success || demo.success || reg.success || kw.success;

  const body: FullSyncApiResponse = {
    success: allSuccess,
    partialSuccess: !allSuccess && anySuccess,
    executedAt,
    dateRange,
    meta: {
      success: meta.success,
      upserted: meta.upserted,
      mappedRecords: meta.mappedRecords,
      datePreset: meta.datePreset,
      ...(meta.error ? { error: meta.error } : {}),
      ...(meta.errorDetail ? { errorDetail: meta.errorDetail } : {}),
    },
    googleAds: {
      success: google.success,
      upserted: google.upserted,
      mappedRecords: google.mappedRecords,
      datePreset: google.datePreset,
      ...(google.error ? { error: google.error } : {}),
    },
    demographic: {
      success: demo.success,
      upserted: demo.upserted,
      genderRecords: demo.genderRecords,
      ageRecords: demo.ageRecords,
      ...(demo.error ? { error: demo.error } : {}),
    },
    regional: {
      success: reg.success,
      upserted: reg.upserted,
      mappedRecords: reg.mappedRecords,
      datePreset: reg.datePreset,
      ...(reg.error ? { error: reg.error } : {}),
    },
    keywords: {
      success: kw.success,
      upserted: kw.rowsUpserted,
      rowsUpserted: kw.rowsUpserted,
      ...(kw.error ? { error: kw.error } : {}),
    },
  };

  // 200 → todos OK; 207 → sucesso parcial; 502 → todos falharam
  const status = allSuccess ? 200 : anySuccess ? 207 : 502;
  return NextResponse.json<FullSyncApiResponse>(body, { status });
}
