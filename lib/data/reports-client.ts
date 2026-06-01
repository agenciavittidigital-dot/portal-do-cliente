import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ClientReportRow {
  id: string;
  title: string;
  period: string;
  filePath: string;
  fileName: string | null;
  fileSize: number | null;
  summary: string | null;
  createdAt: string;
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listPublishedReports(clientId: string): Promise<ClientReportRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("reports")
    .select("id, title, period, file_path, file_name, file_size, summary, created_at")
    .eq("client_id", clientId)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listPublishedReports] Erro:", error.message);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ""),
    title: String(r.title ?? ""),
    period: String(r.period ?? ""),
    filePath: String(r.file_path ?? ""),
    fileName: r.file_name ? String(r.file_name) : null,
    fileSize: r.file_size != null ? Number(r.file_size) : null,
    summary: r.summary ? String(r.summary) : null,
    createdAt: String(r.created_at ?? ""),
  }));
}
