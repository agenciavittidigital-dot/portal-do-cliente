import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ClientCallRow {
  id: string;
  title: string;
  description: string | null;
  callType: string;
  callDate: string;
  durationMinutes: number | null;
  recordingUrl: string | null;
  summary: string | null;
  createdAt: string;
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listPublishedCalls(clientId: string): Promise<ClientCallRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("calls")
    .select("id, title, description, call_type, call_date, duration_minutes, recording_url, summary, created_at")
    .eq("client_id", clientId)
    .eq("status", "published")
    .order("call_date", { ascending: false });

  if (error) {
    console.error("[listPublishedCalls] Erro:", error.message);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ""),
    title: String(r.title ?? ""),
    description: r.description ? String(r.description) : null,
    callType: String(r.call_type ?? "other"),
    callDate: String(r.call_date ?? ""),
    durationMinutes: r.duration_minutes != null ? Number(r.duration_minutes) : null,
    recordingUrl: r.recording_url ? String(r.recording_url) : null,
    summary: r.summary ? String(r.summary) : null,
    createdAt: String(r.created_at ?? ""),
  }));
}
