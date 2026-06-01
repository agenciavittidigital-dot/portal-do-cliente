import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Demographic breakdown ──────────────────────────────────────────────────────

export interface DemographicRow {
  breakdownType: "gender" | "age";
  breakdownValue: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  messages_started: number;
}

export async function loadDemographicBreakdown(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<DemographicRow[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("performance_breakdowns")
      .select("breakdown_type, breakdown_value, spend, impressions, reach, clicks, leads, messages_started")
      .eq("client_id", clientId)
      .in("breakdown_type", ["gender", "age"])
      .gte("date", startDate)
      .lte("date", endDate);

    if (error || !data?.length) return [];

    const byKey = new Map<string, DemographicRow>();

    for (const row of data) {
      const r = row as Record<string, unknown>;
      const type = String(r.breakdown_type ?? "") as "gender" | "age";
      const value = String(r.breakdown_value ?? "").trim();
      if (!value || (type !== "gender" && type !== "age")) continue;

      const key = `${type}::${value}`;
      const spend         = Number(r.spend)            || 0;
      const impressions   = Number(r.impressions)      || 0;
      const reach         = Number(r.reach)            || 0;
      const clicks        = Number(r.clicks)           || 0;
      const leads         = Number(r.leads)            || 0;
      const messages_started = Number(r.messages_started) || 0;

      const existing = byKey.get(key);
      if (existing) {
        existing.spend           += spend;
        existing.impressions     += impressions;
        existing.reach           += reach;
        existing.clicks          += clicks;
        existing.leads           += leads;
        existing.messages_started += messages_started;
      } else {
        byKey.set(key, {
          breakdownType: type,
          breakdownValue: value,
          spend,
          impressions,
          reach,
          clicks,
          leads,
          messages_started,
        });
      }
    }

    return [...byKey.values()];
  } catch {
    return [];
  }
}

// ── Regional breakdown ─────────────────────────────────────────────────────────

export interface RegionRow {
  region: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  messages_started: number;
}

export async function loadRegionalBreakdown(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<RegionRow[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("performance_breakdowns")
      .select("breakdown_value, spend, impressions, reach, clicks, leads, messages_started")
      .eq("client_id", clientId)
      .eq("breakdown_type", "region")
      .gte("date", startDate)
      .lte("date", endDate);

    if (error || !data?.length) return [];

    const byRegion = new Map<
      string,
      { spend: number; impressions: number; reach: number; clicks: number; leads: number; messages_started: number }
    >();

    for (const row of data) {
      const r = row as Record<string, unknown>;
      const region = String(r.breakdown_value ?? "").trim();
      if (!region) continue;

      const spend = Number(r.spend) || 0;
      const impressions = Number(r.impressions) || 0;
      const reach = Number(r.reach) || 0;
      const clicks = Number(r.clicks) || 0;
      const leads = Number(r.leads) || 0;
      const messages_started = Number(r.messages_started) || 0;

      const existing = byRegion.get(region);
      if (existing) {
        existing.spend += spend;
        existing.impressions += impressions;
        existing.reach += reach;
        existing.clicks += clicks;
        existing.leads += leads;
        existing.messages_started += messages_started;
      } else {
        byRegion.set(region, { spend, impressions, reach, clicks, leads, messages_started });
      }
    }

    return [...byRegion.entries()]
      .map(([region, metrics]) => ({ region, ...metrics }))
      .sort((a, b) => b.spend - a.spend);
  } catch {
    return [];
  }
}
