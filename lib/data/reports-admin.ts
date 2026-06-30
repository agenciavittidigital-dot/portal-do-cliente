import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReportStatus = "draft" | "published" | "archived";

export interface AdminReportRow {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  period: string;
  filePath: string;
  fileName: string | null;
  fileType: string;
  fileSize: number | null;
  status: ReportStatus;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCreateInput {
  clientId: string;
  title: string;
  description?: string | null;
  period: string;
  status?: ReportStatus;
  filePath: string;
  fileName?: string | null;
  fileType: string;
  fileSize?: number | null;
  summary?: string | null;
}

export interface ReportUpdateInput {
  title?: string;
  description?: string | null;
  period?: string;
  status?: ReportStatus;
  summary?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const COLS =
  "id, client_id, title, description, period, file_path, file_name, file_type, file_size, status, summary, created_at, updated_at";

function coerceStatus(raw: unknown): ReportStatus {
  if (raw === "published" || raw === "archived") return raw;
  return "draft";
}

function coerceRow(r: Record<string, unknown>): AdminReportRow {
  return {
    id: String(r.id ?? ""),
    clientId: String(r.client_id ?? ""),
    title: String(r.title ?? ""),
    description: r.description ? String(r.description) : null,
    period: String(r.period ?? ""),
    filePath: String(r.file_path ?? ""),
    fileName: r.file_name ? String(r.file_name) : null,
    fileType: String(r.file_type ?? "application/octet-stream"),
    fileSize: r.file_size != null ? Number(r.file_size) : null,
    status: coerceStatus(r.status),
    summary: r.summary ? String(r.summary) : null,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listReportsByClient(clientId: string): Promise<AdminReportRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("reports")
    .select(COLS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listReportsByClient] Erro:", error.message);
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => coerceRow(r as Record<string, unknown>));
}

export async function getReportById(id: string): Promise<AdminReportRow | null> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("reports")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getReportById] Erro:", error.message);
    throw new Error(error.message);
  }
  return data ? coerceRow(data as Record<string, unknown>) : null;
}

export async function createReport(input: ReportCreateInput): Promise<AdminReportRow> {
  const admin = mkAdmin();

  const row = {
    client_id: input.clientId,
    title: input.title,
    description: input.description ?? null,
    period: input.period,
    status: (input.status ?? "draft") as ReportStatus,
    file_path: input.filePath,
    file_name: input.fileName ?? null,
    file_type: input.fileType,
    file_size: input.fileSize ?? null,
    summary: input.summary ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("reports")
    .insert(row)
    .select(COLS)
    .single();

  if (error) {
    console.error("[createReport] Supabase error:", error.code, error.message, error.hint ?? "");
    throw new Error(error.message);
  }
  return coerceRow(data as Record<string, unknown>);
}

export async function deleteReport(id: string): Promise<{ filePath: string }> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("reports")
    .delete()
    .eq("id", id)
    .select("file_path")
    .single();

  if (error) {
    console.error("[deleteReport] Supabase error:", error.code, error.message);
    throw new Error(error.message);
  }
  return { filePath: String((data as Record<string, unknown>).file_path ?? "") };
}

export async function updateReport(
  id: string,
  patch: ReportUpdateInput
): Promise<AdminReportRow> {
  const admin = mkAdmin();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) updateData.title = patch.title;
  if ("description" in patch) updateData.description = patch.description || null;
  if (patch.period !== undefined) updateData.period = patch.period;
  if (patch.status !== undefined) updateData.status = patch.status;
  if ("summary" in patch) updateData.summary = patch.summary || null;

  const { data, error } = await admin
    .from("reports")
    .update(updateData)
    .eq("id", id)
    .select(COLS)
    .single();

  if (error) {
    console.error("[updateReport] Supabase error:", error.code, error.message, error.hint ?? "");
    throw new Error(error.message);
  }
  return coerceRow(data as Record<string, unknown>);
}
