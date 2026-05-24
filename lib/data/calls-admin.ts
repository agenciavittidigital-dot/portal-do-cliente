import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CallType =
  | "performance"
  | "alignment"
  | "planning"
  | "onboarding"
  | "report_presentation"
  | "other";

export type CallStatus = "draft" | "published" | "archived";

export interface AdminCallRow {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  callType: CallType;
  callDate: string;
  durationMinutes: number | null;
  recordingUrl: string | null;
  summary: string | null;
  status: CallStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CallCreateInput {
  clientId: string;
  title: string;
  description?: string | null;
  callType: CallType;
  callDate: string;
  durationMinutes?: number | null;
  recordingUrl?: string | null;
  summary?: string | null;
  status?: CallStatus;
}

export interface CallUpdateInput {
  title?: string;
  description?: string | null;
  callType?: CallType;
  callDate?: string;
  durationMinutes?: number | null;
  recordingUrl?: string | null;
  summary?: string | null;
  status?: CallStatus;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const COLS =
  "id, client_id, title, description, call_type, call_date, duration_minutes, recording_url, summary, status, created_at, updated_at";

const VALID_TYPES: CallType[] = [
  "performance",
  "alignment",
  "planning",
  "onboarding",
  "report_presentation",
  "other",
];

function coerceCallType(raw: unknown): CallType {
  if (VALID_TYPES.includes(raw as CallType)) return raw as CallType;
  return "alignment";
}

function coerceStatus(raw: unknown): CallStatus {
  if (raw === "published" || raw === "archived") return raw;
  return "draft";
}

function coerceRow(r: Record<string, unknown>): AdminCallRow {
  return {
    id: String(r.id ?? ""),
    clientId: String(r.client_id ?? ""),
    title: String(r.title ?? ""),
    description: r.description ? String(r.description) : null,
    callType: coerceCallType(r.call_type),
    callDate: String(r.call_date ?? ""),
    durationMinutes: r.duration_minutes != null ? Number(r.duration_minutes) : null,
    recordingUrl: r.recording_url ? String(r.recording_url) : null,
    summary: r.summary ? String(r.summary) : null,
    status: coerceStatus(r.status),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listCallsByClient(clientId: string): Promise<AdminCallRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("calls")
    .select(COLS)
    .eq("client_id", clientId)
    .order("call_date", { ascending: false });

  if (error) {
    console.error("[listCallsByClient] Erro:", error.message);
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => coerceRow(r as Record<string, unknown>));
}

export async function createCall(input: CallCreateInput): Promise<AdminCallRow> {
  const admin = mkAdmin();

  const row = {
    client_id: input.clientId,
    title: input.title,
    description: input.description ?? null,
    call_type: input.callType,
    call_date: input.callDate,
    duration_minutes: input.durationMinutes ?? null,
    recording_url: input.recordingUrl ?? null,
    summary: input.summary ?? null,
    status: input.status ?? "draft",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("calls")
    .insert(row)
    .select(COLS)
    .single();

  if (error) {
    console.error("[createCall] Supabase error:", error.code, error.message, error.hint ?? "");
    throw new Error(error.message);
  }
  return coerceRow(data as Record<string, unknown>);
}

export async function updateCall(id: string, patch: CallUpdateInput): Promise<AdminCallRow> {
  const admin = mkAdmin();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) updateData.title = patch.title;
  if ("description" in patch) updateData.description = patch.description || null;
  if (patch.callType !== undefined) updateData.call_type = patch.callType;
  if (patch.callDate !== undefined) updateData.call_date = patch.callDate;
  if ("durationMinutes" in patch) updateData.duration_minutes = patch.durationMinutes ?? null;
  if ("recordingUrl" in patch) updateData.recording_url = patch.recordingUrl || null;
  if ("summary" in patch) updateData.summary = patch.summary || null;
  if (patch.status !== undefined) updateData.status = patch.status;

  const { data, error } = await admin
    .from("calls")
    .update(updateData)
    .eq("id", id)
    .select(COLS)
    .single();

  if (error) {
    console.error("[updateCall] Supabase error:", error.code, error.message, error.hint ?? "");
    throw new Error(error.message);
  }
  return coerceRow(data as Record<string, unknown>);
}
