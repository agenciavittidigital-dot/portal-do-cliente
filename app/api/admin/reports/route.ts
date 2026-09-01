import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { listReportsByClient, createReport } from "@/lib/data/reports-admin";
import type { AdminReportRow, ReportStatus } from "@/lib/data/reports-admin";
import { deletePortalFile } from "@/lib/storage/portal-files";

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
const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg"];

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

interface ReportCreateBody {
  clientId: string;
  filePath: string;
  fileName?: string;
  fileType: string;
  fileSize?: number;
  title: string;
  period: string;
  status?: string;
  summary?: string | null;
  description?: string | null;
}

// POST /api/admin/reports — accepts JSON metadata; file must already be in Storage
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: ReportCreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "Body inválido — JSON esperado." },
      { status: 400 }
    );
  }

  const {
    clientId,
    filePath,
    fileName,
    fileType,
    fileSize,
    title,
    period,
    status: rawStatus,
    summary: rawSummary,
    description: rawDescription,
  } = body;

  if (!clientId || typeof clientId !== "string" || !clientId.trim()) {
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "clientId é obrigatório." },
      { status: 400 }
    );
  }
  if (!filePath || typeof filePath !== "string" || !filePath.trim()) {
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "filePath é obrigatório." },
      { status: 400 }
    );
  }
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "Título é obrigatório." },
      { status: 400 }
    );
  }
  if (!period || typeof period !== "string" || !period.trim()) {
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "Período é obrigatório." },
      { status: 400 }
    );
  }
  if (!fileType || !ALLOWED_MIME.includes(fileType)) {
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "Tipo de arquivo não permitido. Use PDF, PNG ou JPEG." },
      { status: 400 }
    );
  }

  // Security: filePath must belong to this client's reports folder
  const expectedPrefix = `clients/${clientId.trim()}/reports/`;
  if (!filePath.trim().startsWith(expectedPrefix)) {
    return NextResponse.json<ReportCreateResponse>(
      { success: false, error: "filePath inválido." },
      { status: 400 }
    );
  }

  const status: ReportStatus =
    typeof rawStatus === "string" && VALID_STATUSES.includes(rawStatus as ReportStatus)
      ? (rawStatus as ReportStatus)
      : "draft";
  const summary =
    typeof rawSummary === "string" && rawSummary.trim() ? rawSummary.trim() : null;
  const description =
    typeof rawDescription === "string" && rawDescription.trim()
      ? rawDescription.trim()
      : null;
  const parsedFileSize =
    typeof fileSize === "number" && fileSize > 0 ? fileSize : null;

  try {
    const report = await createReport({
      clientId: clientId.trim(),
      title: title.trim(),
      period: period.trim(),
      status,
      filePath: filePath.trim(),
      fileName: typeof fileName === "string" && fileName.trim() ? fileName.trim() : null,
      fileType: mimeToFileType(fileType),
      fileSize: parsedFileSize,
      summary,
      description,
    });
    return NextResponse.json<ReportCreateResponse>({ success: true, report }, { status: 201 });
  } catch (err) {
    // Orphan cleanup — remove the file that was already uploaded to Storage
    await deletePortalFile(filePath.trim()).catch(() => {});
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
            : "Falha ao salvar o relatório. Tente novamente.",
        detail,
      },
      { status: 500 }
    );
  }
}
