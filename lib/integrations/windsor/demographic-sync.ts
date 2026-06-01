import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { WINDSOR_DEMOGRAPHIC_FIELDS } from "./client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeNum(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  const s = String(val).trim();
  return s || null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DemographicSyncResult {
  success: boolean;
  totalFetched: number;
  genderRecords: number;
  ageRecords: number;
  upserted: number;
  skippedUnmapped: number;
  unmappedAccounts: string[];
  error?: string;
  errorDetail?: string;
}

// ── Core sync ─────────────────────────────────────────────────────────────────

export async function syncWindsorDemographicBreakdown(): Promise<DemographicSyncResult> {
  const base: DemographicSyncResult = {
    success: false,
    totalFetched: 0,
    genderRecords: 0,
    ageRecords: 0,
    upserted: 0,
    skippedUnmapped: 0,
    unmappedAccounts: [],
  };

  // ── 1. Fetch Windsor com campos de gênero e idade ─────────────────────────
  const apiKey = process.env.WINDSOR_API_KEY?.trim();
  if (!apiKey) {
    return { ...base, error: "WINDSOR_API_KEY não configurada no ambiente." };
  }

  const url = new URL("https://connectors.windsor.ai/all");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("fields", WINDSOR_DEMOGRAPHIC_FIELDS.join(","));
  url.searchParams.set("date_preset", "last_30d");

  let rawData: Array<Record<string, unknown>> = [];
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const safeBody = body.replace(/api_key=[^\s&"']*/gi, "api_key=***").slice(0, 300);
      return {
        ...base,
        error: `Windsor respondeu com HTTP ${res.status}`,
        errorDetail: safeBody || undefined,
      };
    }
    const json = await res.json();
    rawData = Array.isArray(json?.data)
      ? (json.data as Array<Record<string, unknown>>)
      : [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { ...base, error: `Falha na conexão com Windsor: ${msg}` };
  }

  base.totalFetched = rawData.length;
  if (!rawData.length) return { ...base, success: true };

  const admin = createAdminClient();

  // ── 2. Carregar integrações Meta Ads ativas ───────────────────────────────
  const { data: integrationRows, error: integError } = await admin
    .from("client_integrations")
    .select("id, client_id, account_name")
    .eq("provider", "windsor")
    .eq("channel", "meta_ads")
    .eq("status", "active");

  if (integError) {
    return { ...base, error: "Erro ao carregar integrações.", errorDetail: integError.message };
  }

  const integByName = new Map<string, { integrationId: string; clientId: string }>();
  for (const row of integrationRows ?? []) {
    const name = String(row.account_name ?? "").trim();
    if (!name) continue;
    integByName.set(name, {
      integrationId: String(row.id),
      clientId: String(row.client_id),
    });
  }

  // ── 3. Agregar separadamente por gender e age ─────────────────────────────
  // Um único request retorna rows com gender E age populados.
  // Agregamos por dimensão independente — sem double-counting.

  type Accum = {
    clientId: string;
    integrationId: string;
    date: string;
    breakdownType: "gender" | "age";
    breakdownValue: string;
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    leads: number;
    messages_started: number;
  };

  const aggregated = new Map<string, Accum>();
  const unmappedSet = new Set<string>();

  for (const raw of rawData) {
    const accountName = String(raw.account_name ?? "").trim();
    if (!accountName) continue;

    const integ = integByName.get(accountName);
    if (!integ) {
      unmappedSet.add(accountName);
      base.skippedUnmapped++;
      continue;
    }

    const date = safeStr(raw.date) ?? new Date().toISOString().slice(0, 10);
    const spend = safeNum(raw.spend);
    const impressions = safeNum(raw.impressions);
    const reach = safeNum(raw.reach);
    const clicks = safeNum(raw.clicks);
    const leads = safeNum(raw.leads);
    const messages_started = safeNum(raw.messages_started);

    function accumulate(bType: "gender" | "age", bValue: string) {
      const key = `${integ!.clientId}::${integ!.integrationId}::${bType}::${bValue}::${date}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.spend += spend;
        existing.impressions += impressions;
        existing.reach += reach;
        existing.clicks += clicks;
        existing.leads += leads;
        existing.messages_started += messages_started;
      } else {
        aggregated.set(key, {
          clientId: integ!.clientId,
          integrationId: integ!.integrationId,
          date,
          breakdownType: bType,
          breakdownValue: bValue,
          spend,
          impressions,
          reach,
          clicks,
          leads,
          messages_started,
        });
      }
    }

    const gender = safeStr(raw.gender);
    if (gender) accumulate("gender", gender);

    const age = safeStr(raw.age);
    if (age) accumulate("age", age);
  }

  base.unmappedAccounts = [...unmappedSet].slice(0, 10);

  const allRows = [...aggregated.values()];
  base.genderRecords = allRows.filter((r) => r.breakdownType === "gender").length;
  base.ageRecords    = allRows.filter((r) => r.breakdownType === "age").length;

  if (allRows.length === 0) return { ...base, success: true };

  // ── 4. Upsert em performance_breakdowns ───────────────────────────────────
  const syncedAt = new Date().toISOString();
  const rows = allRows.map((rec) => ({
    client_id:       rec.clientId,
    integration_id:  rec.integrationId,
    channel:         "meta_ads",
    breakdown_type:  rec.breakdownType,
    breakdown_value: rec.breakdownValue,
    date:            rec.date,
    spend:           rec.spend,
    impressions:     rec.impressions,
    reach:           rec.reach,
    clicks:          rec.clicks,
    leads:           rec.leads,
    messages_started: rec.messages_started,
    synced_at:       syncedAt,
    updated_at:      syncedAt,
  }));

  const { error: upsertError } = await admin
    .from("performance_breakdowns")
    .upsert(rows, {
      onConflict: "client_id,integration_id,channel,breakdown_type,breakdown_value,date",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    return {
      ...base,
      error: "Falha ao gravar em performance_breakdowns.",
      errorDetail: upsertError.message,
    };
  }

  base.upserted = rows.length;
  return { ...base, success: true };
}
