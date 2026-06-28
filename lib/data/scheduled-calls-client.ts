import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ScheduledCall {
  id: string;
  clientId: string;
  title: string;
  callType: string;
  scheduledAt: string;
  meetingUrl: string | null;
  status: string;
}

export async function getNextScheduledCall(clientId: string): Promise<ScheduledCall | null> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("scheduled_calls")
    .select("id, client_id, title, call_type, scheduled_at, meeting_url, status")
    .eq("client_id", clientId)
    .eq("status", "upcoming")
    .gte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getNextScheduledCall] Erro:", error.message);
    return null;
  }

  if (!data) return null;

  const r = data as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    clientId: String(r.client_id ?? ""),
    title: String(r.title ?? ""),
    callType: String(r.call_type ?? "alignment"),
    scheduledAt: String(r.scheduled_at ?? ""),
    meetingUrl: r.meeting_url ? String(r.meeting_url) : null,
    status: String(r.status ?? ""),
  };
}
