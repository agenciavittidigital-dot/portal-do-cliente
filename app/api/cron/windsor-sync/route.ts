import "server-only";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { syncWindsorMappedAccounts } from "@/lib/integrations/windsor/sync";
import { syncGoogleAdsMappedAccounts } from "@/lib/integrations/windsor/google-ads-sync";
import { syncWindsorDemographicBreakdown } from "@/lib/integrations/windsor/demographic-sync";
import { syncWindsorRegionalBreakdown } from "@/lib/integrations/windsor/regional-sync";
import type { SyncResult } from "@/lib/integrations/windsor/sync";
import type { GoogleAdsSyncResult } from "@/lib/integrations/windsor/google-ads-sync";
import type { DemographicSyncResult } from "@/lib/integrations/windsor/demographic-sync";
import type { RegionalSyncResult } from "@/lib/integrations/windsor/regional-sync";

// Permite até 300s no Vercel Pro — necessário para 4 syncs paralelos com last_30d.
export const maxDuration = 300;

// ── Tipos de resposta ──────────────────────────────────────────────────────────

export interface CronSyncResponse {
  success: boolean;
  executedAt: string;
  meta: SyncResult | null;
  googleAds: GoogleAdsSyncResult | null;
  demographic: DemographicSyncResult | null;
  regional: RegionalSyncResult | null;
  error?: string;
}

// ── Fallbacks para Promise.allSettled rejeições ────────────────────────────────

function metaFallback(cause: unknown): SyncResult {
  return {
    success: false,
    totalFetched: 0,
    mappedRecords: 0,
    groupedRecords: 0,
    skippedUnmapped: 0,
    upserted: 0,
    errors: 1,
    datePreset: "last_7d",
    fieldsSynced: [],
    unmappedAccounts: [],
    sampleSaved: [],
    error: cause instanceof Error ? cause.message : "Erro inesperado durante sync Meta Ads.",
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
    datePreset: "last_7d",
    fieldsSynced: [],
    unmappedAccounts: [],
    sampleSaved: [],
    error: cause instanceof Error ? cause.message : "Erro inesperado durante sync Google Ads.",
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
    error: cause instanceof Error ? cause.message : "Erro inesperado durante sync demográfico.",
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
    datePreset: "last_7d",
    fieldsSynced: [],
    unmappedAccounts: [],
    sampleSaved: [],
    error: cause instanceof Error ? cause.message : "Erro inesperado durante sync regional.",
  };
}

// ── Handler principal (GET — compatível com Vercel Cron e chamadas externas) ──
//
// Autenticação: Authorization: Bearer <WINDSOR_CRON_SECRET>
//
// Vercel Cron injeta automaticamente CRON_SECRET no ambiente e envia
// Authorization: Bearer <CRON_SECRET> em cada chamada agendada.
// Para chamadas externas ou testes manuais, use WINDSOR_CRON_SECRET.
// A rota aceita ambos: WINDSOR_CRON_SECRET tem prioridade.

export async function GET(request: NextRequest): Promise<Response> {
  const expected =
    process.env.WINDSOR_CRON_SECRET ?? process.env.CRON_SECRET;

  const authHeader = request.headers.get("authorization");

  if (!expected || !authHeader || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json<CronSyncResponse>(
      {
        success: false,
        executedAt: new Date().toISOString(),
        meta: null,
        googleAds: null,
        demographic: null,
        regional: null,
        error: "Não autorizado.",
      },
      { status: 401 }
    );
  }

  const executedAt = new Date().toISOString();

  // Executa os 4 syncs em paralelo.
  // Promise.allSettled garante que uma falha não cancela os demais.
  const [metaSettled, googleSettled, demographicSettled, regionalSettled] =
    await Promise.allSettled([
      syncWindsorMappedAccounts(),
      syncGoogleAdsMappedAccounts(),
      syncWindsorDemographicBreakdown(),
      syncWindsorRegionalBreakdown(),
    ]);

  const meta: SyncResult =
    metaSettled.status === "fulfilled"
      ? metaSettled.value
      : metaFallback(metaSettled.reason);

  const googleAds: GoogleAdsSyncResult =
    googleSettled.status === "fulfilled"
      ? googleSettled.value
      : googleAdsFallback(googleSettled.reason);

  const demographic: DemographicSyncResult =
    demographicSettled.status === "fulfilled"
      ? demographicSettled.value
      : demographicFallback(demographicSettled.reason);

  const regional: RegionalSyncResult =
    regionalSettled.status === "fulfilled"
      ? regionalSettled.value
      : regionalFallback(regionalSettled.reason);

  const overallSuccess =
    meta.success && googleAds.success && demographic.success && regional.success;

  // 200 → todos OK; 207 → ao menos um falhou (partial success)
  return NextResponse.json<CronSyncResponse>(
    { success: overallSuccess, executedAt, meta, googleAds, demographic, regional },
    { status: overallSuccess ? 200 : 207 }
  );
}
