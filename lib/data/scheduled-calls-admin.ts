import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ScheduledCallStatus = "upcoming" | "done" | "cancelled";

export type ScheduledCallType =
  | "performance"
  | "alignment"
  | "planning"
  | "onboarding"
  | "report_presentation"
  | "other";

export interface AdminScheduledCallRow {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  callType: ScheduledCallType;
  scheduledAt: string;
  meetingUrl: string | null;
  status: ScheduledCallStatus;
  createdAt: string;
}

export interface ScheduledCallCreateInput {
  clientId: string;
  title: string;
  callType: ScheduledCallType;
  scheduledAt: string;
  meetingUrl?: string | null;
  status?: ScheduledCallStatus;
}

export interface ScheduledCallUpdateInput {
  title?: string;
  callType?: ScheduledCallType;
  scheduledAt?: string;
  meetingUrl?: string | null;
  status?: ScheduledCallStatus;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const COLS =
  "id, client_id, title, call_type, scheduled_at, meeting_url, status, created_at, clients(name)";

const VALID_STATUSES: ScheduledCallStatus[] = ["upcoming", "done", "cancelled"];

const VALID_TYPES: ScheduledCallType[] = [
  "performance",
  "alignment",
  "planning",
  "onboarding",
  "report_presentation",
  "other",
];

function coerceStatus(raw: unknown): ScheduledCallStatus {
  if (VALID_STATUSES.includes(raw as ScheduledCallStatus))
    return raw as ScheduledCallStatus;
  return "upcoming";
}

function coerceCallType(raw: unknown): ScheduledCallType {
  if (VALID_TYPES.includes(raw as ScheduledCallType))
    return raw as ScheduledCallType;
  return "alignment";
}

function coerceRow(r: Record<string, unknown>): AdminScheduledCallRow {
  const clients = r.clients as Record<string, unknown> | null;
  return {
    id: String(r.id ?? ""),
    clientId: String(r.client_id ?? ""),
    clientName: clients?.name ? String(clients.name) : "",
    title: String(r.title ?? ""),
    callType: coerceCallType(r.call_type),
    scheduledAt: String(r.scheduled_at ?? ""),
    meetingUrl: r.meeting_url ? String(r.meeting_url) : null,
    status: coerceStatus(r.status),
    createdAt: String(r.created_at ?? ""),
  };
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listAllScheduledCalls(): Promise<AdminScheduledCallRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("scheduled_calls")
    .select(COLS)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => coerceRow(r as Record<string, unknown>));
}

export async function createScheduledCall(
  input: ScheduledCallCreateInput
): Promise<AdminScheduledCallRow> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("scheduled_calls")
    .insert({
      client_id: input.clientId,
      title: input.title,
      call_type: input.callType,
      scheduled_at: input.scheduledAt,
      meeting_url: input.meetingUrl ?? null,
      status: input.status ?? "upcoming",
    })
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return coerceRow(data as Record<string, unknown>);
}

export async function updateScheduledCall(
  id: string,
  patch: ScheduledCallUpdateInput
): Promise<AdminScheduledCallRow> {
  const admin = mkAdmin();
  const updateData: Record<string, unknown> = {};
  if (patch.title !== undefined) updateData.title = patch.title;
  if (patch.callType !== undefined) updateData.call_type = patch.callType;
  if (patch.scheduledAt !== undefined) updateData.scheduled_at = patch.scheduledAt;
  if ("meetingUrl" in patch) updateData.meeting_url = patch.meetingUrl ?? null;
  if (patch.status !== undefined) updateData.status = patch.status;

  const { data, error } = await admin
    .from("scheduled_calls")
    .update(updateData)
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return coerceRow(data as Record<string, unknown>);
}
