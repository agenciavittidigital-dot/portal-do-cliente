import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { listReportsByClient, createReport } from "@/lib/data/reports-admin";
import type { AdminReportRow, ReportStatus } from "@/lib/data/reports-admin";
import { uploadPortalFile, deletePortalFile } from "@/lib/storage/portal-files";

export interface ReportListResponse {
  success: boolean;
  reports?: AdminReportRow[];
  error?: string;
  detail?: string;
}

export interface ReportCreateResponse {
  success: boolean;
  report?: AdminReportRow;
  error?: string;
  detail?: string;
}

async function requireAdmin(): Promise<{ userId: string } | { error: Response }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json<ReportListResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<ReportListResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

// Maps browser MIME type → short value accepted by the DB check constraint
function mimeToFileType(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  return mime.split("/").pop() ?? "pdf";
}

const VALID_STATUSES: ReportStatus[] = ["draft", "published", "archived"];

// GET /api/admin/reports?clientId=...
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const clientId = new URL(req.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json<ReportListResponse>(
      { success: false, error: "clientId é obrigatório." },
      { status: 400 }
    );
  }

  try {
    const reports = await listReportsByClient(clientId);
    return NextResponse.json<ReportListResponse>({ success: true, reports });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<ReportListResponse>(
      { success: false, error: "Erro ao listar relatórios.", detail },
      { status: 500 }
    );
  }
}

// POST /api/admin/reports — accepts multipart/form-data
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "Falha ao processar o formulário." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "Arquivo do relatório é obrigatório." },
      { status: 400 }
    );
  }

  const clientId = formData.get("clientId");
  if (!clientId || typeof clientId !== "string" || !clientId.trim()) {
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "clientId é obrigatório." },
      { status: 400 }
    );
  }

  const title = formData.get("title");
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "Título é obrigatório." },
      { status: 400 }
    );
  }

  const period = formData.get("period");
  if (!period || typeof period !== "string" || !period.trim()) {
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "Período é obrigatório." },
      { status: 400 }
    );
  }

  const rawStatus = formData.get("status");
  const status: ReportStatus =
    typeof rawStatus === "string" && VALID_STATUSES.includes(rawStatus as ReportStatus)
      ? (rawStatus as ReportStatus)
      : "draft";

  const rawSummary = formData.get("summary");
  const summary =
    typeof rawSummary === "string" && rawSummary.trim() ? rawSummary.trim() : null;

  const rawDescription = formData.get("description");
  const description =
    typeof rawDescription === "string" && rawDescription.trim()
      ? rawDescription.trim()
      : null;

  // Upload to Storage first
  let uploaded: Awaited<ReturnType<typeof uploadPortalFile>>;
  try {
    uploaded = await uploadPortalFile(file, `clients/${clientId.trim()}/reports`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "Falha ao enviar arquivo.", detail },
      { status: 500 }
    );
  }

  // Insert into DB — cleanup orphan file if this fails
  try {
    const report = await createReport({
      clientId: clientId.trim(),
      title: title.trim(),
      period: period.trim(),
      status,
      filePath: uploaded.filePath,
      fileName: uploaded.fileName,
      fileType: mimeToFileType(uploaded.fileType),
      fileSize: uploaded.fileSize,
      summary,
      description,
    });
    return NextResponse.json<ReportCreateResponse>({ success: true, report }, { status: 201 });
  } catch (err) {
    await deletePortalFile(uploaded.filePath).catch(() => {});
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    console.error("[POST /api/admin/reports] DB insert falhou:", detail);
    const isStatusConstraint = detail.includes("status_check");
    const isFileTypeConstraint = detail.includes("file_type_check");
    return NextResponse.json<ReportCreateResponse>(
      {
        success: false,
        error: isStatusConstraint
          ? "Status inválido para o relatório."
          : isFileTypeConstraint
            ? "Tipo de arquivo não aceito pelo banco. Use PDF, PNG ou JPEG."
            : "Erro ao salvar relatório no banco.",
        detail,
      },
      { status: 500 }
    );
  }
}
