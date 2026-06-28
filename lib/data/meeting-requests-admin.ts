import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MeetingRequestStatus = "pending" | "scheduled" | "cancelled" | "done";
export type MeetingShift = "morning" | "afternoon";

export interface AdminMeetingRequestRow {
  id: string;
  clientId: string;
  clientName: string;
  profileId: string | null;
  userName: string;
  userEmail: string;
  shift: MeetingShift;
  reason: string;
  status: MeetingRequestStatus;
  requestedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const COLS =
  "id, client_id, client_name, profile_id, user_name, user_email, shift, reason, status, requested_at";

function coerceStatus(raw: unknown): MeetingRequestStatus {
  if (
    raw === "pending" ||
    raw === "scheduled" ||
    raw === "cancelled" ||
    raw === "done"
  )
    return raw;
  return "pending";
}

function coerceShift(raw: unknown): MeetingShift {
  if (raw === "afternoon") return "afternoon";
  return "morning";
}

function coerceRow(r: Record<string, unknown>): AdminMeetingRequestRow {
  return {
    id: String(r.id ?? ""),
    clientId: String(r.client_id ?? ""),
    clientName: String(r.client_name ?? ""),
    profileId: r.profile_id ? String(r.profile_id) : null,
    userName: String(r.user_name ?? ""),
    userEmail: String(r.user_email ?? ""),
    shift: coerceShift(r.shift),
    reason: String(r.reason ?? ""),
    status: coerceStatus(r.status),
    requestedAt: String(r.requested_at ?? ""),
  };
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listAllMeetingRequests(): Promise<AdminMeetingRequestRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("meeting_requests")
    .select(COLS)
    .order("requested_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => coerceRow(r as Record<string, unknown>));
}

export async function updateMeetingRequestStatus(
  id: string,
  status: MeetingRequestStatus
): Promise<void> {
  const admin = mkAdmin();
  const { error } = await admin
    .from("meeting_requests")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
