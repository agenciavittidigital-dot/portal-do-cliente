import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { resolveClientForUser } from "@/lib/data/invoices-client";
import { listPublishedReports } from "@/lib/data/reports-client";
import type { ClientReportRow } from "@/lib/data/reports-client";
import { getSignedDownloadUrl } from "@/lib/storage/portal-files";
import { ReportFilter } from "@/components/relatorios/ReportFilter";
import type { FilterOption } from "@/components/relatorios/ReportFilter";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
} from "lucide-react";
import Link from "next/link";

// ── Constantes ────────────────────────────────────────────────────────────────

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PER_PAGE = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildPageUrl(
  opts: { clientId?: string | null; year?: number | null; month?: number | null },
  targetPage: number
): string {
  const p = new URLSearchParams();
  if (opts.clientId) p.set("clientId", opts.clientId);
  if (opts.year)  p.set("year",  String(opts.year));
  if (opts.month) p.set("month", String(opts.month));
  if (targetPage > 1) p.set("page", String(targetPage));
  const qs = p.toString();
  return `/relatorios${qs ? `?${qs}` : ""}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    page?: string;
    year?: string;
    month?: string;
  }>;
}) {
  const params = await searchParams;
  const urlClientId  = params.clientId;
  const page         = Math.max(1, parseInt(params.page  ?? "1") || 1);
  const filterYear   = params.year  ? parseInt(params.year)  : null;
  const filterMonth  = params.month ? parseInt(params.month) : null;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ctx     = user ? await loadUserContext(user.id) : null;
  const isAdmin = ctx?.isAdmin ?? false;

  // ── Dados ─────────────────────────────────────────────────────────────────
  let allReports: ClientReportRow[] = [];
  const downloadUrls: Record<string, string | null> = {};
  let clientFound  = false;
  let adminPreview = false;
  let clientIdForUrl: string | null = null; // só enviado na URL para admin preview

  if (user) {
    if (isAdmin) {
      if (urlClientId) {
        adminPreview  = true;
        clientFound   = true;
        clientIdForUrl = urlClientId;
        allReports    = await listPublishedReports(urlClientId);
      }
    } else {
      const resolvedId = await resolveClientForUser(user.id);
      if (resolvedId) {
        clientFound = true;
        allReports  = await listPublishedReports(resolvedId);
      }
    }
  }

  // ── Opções de filtro (de todas as datas, antes de filtrar) ────────────────
  const filterMap = new Map<string, FilterOption>();
  for (const rep of allReports) {
    const d     = new Date(rep.createdAt);
    const year  = d.getFullYear();
    const month = d.getMonth() + 1;
    const key   = `${year}-${String(month).padStart(2, "0")}`;
    if (!filterMap.has(key)) {
      filterMap.set(key, { value: key, label: `${MONTHS_PT[month - 1]} ${year}` });
    }
  }
  const filterOptions    = [...filterMap.values()];
  const currentFilterVal = filterYear && filterMonth
    ? `${filterYear}-${String(filterMonth).padStart(2, "0")}`
    : "";

  // ── Filtragem e paginação ─────────────────────────────────────────────────
  const filteredReports = filterYear
    ? allReports.filter((rep) => {
        const d = new Date(rep.createdAt);
        if (filterMonth) return d.getFullYear() === filterYear && d.getMonth() + 1 === filterMonth;
        return d.getFullYear() === filterYear;
      })
    : allReports;

  const totalPages  = Math.max(1, Math.ceil(filteredReports.length / PER_PAGE));
  const safePage    = Math.min(page, totalPages);
  const pageReports = filteredReports.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const latestReport: ClientReportRow | null = allReports[0] ?? null;

  // ── URLs de download (latest + página atual) ──────────────────────────────
  const idsToFetch = new Set<string>();
  if (latestReport) idsToFetch.add(latestReport.id);
  pageReports.forEach((r) => idsToFetch.add(r.id));

  await Promise.all(
    [...idsToFetch].map(async (id) => {
      const rep = allReports.find((r) => r.id === id)!;
      try {
        downloadUrls[id] = await getSignedDownloadUrl(rep.filePath, 3600);
      } catch {
        downloadUrls[id] = null;
      }
    })
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl">

      {/* Cabeçalho */}
      <div>
        <h2 className="text-xl font-light text-[#171f38] tracking-wide">Relatórios</h2>
        <p className="text-sm text-[#171f38]/50 mt-0.5 font-light">
          Relatórios mensais e personalizados da sua conta
        </p>
      </div>

      {/* Admin: sem clientId selecionado */}
      {isAdmin && !adminPreview && (
        <div className="rounded-xl border bg-[#f1f1f1] border-[#dfdedf] p-4 flex items-center gap-3">
          <FileText size={14} className="text-[#455cab]/50 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-light text-[#171f38]">
              Você está autenticado como administrador Vitti.
            </p>
            <p className="text-xs text-[#171f38]/50 font-light mt-0.5">
              Selecione um cliente em Admin → Relatórios e clique em &ldquo;Ver como cliente&rdquo;.
            </p>
          </div>
          <Link
            href="/admin/relatorios"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#455cab]/30 text-[11px] font-light text-[#455cab]/70 hover:border-[#455cab]/60 hover:text-[#455cab] transition-all shrink-0"
          >
            <ExternalLink size={11} />
            Admin Relatórios
          </Link>
        </div>
      )}

      {/* Admin: modo preview */}
      {isAdmin && adminPreview && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[#455cab]/20 bg-[#455cab]/[0.04]">
          <span className="text-[10px] font-light text-[#455cab]/60">
            Visualização do cliente — modo admin
          </span>
          <Link
            href="/admin/relatorios"
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-light text-[#455cab]/60 hover:text-[#455cab] transition-colors"
          >
            <ArrowLeft size={9} />
            Voltar ao Admin
          </Link>
        </div>
      )}

      {/* Cliente sem vínculo */}
      {!isAdmin && !clientFound && (
        <div className="rounded-xl border border-dashed border-[#dfdedf] py-16 flex flex-col items-center justify-center gap-3">
          <FileText size={20} className="text-[#455cab]/20" />
          <p className="text-sm font-light text-[#171f38]/50">
            Nenhum cliente vinculado à sua conta.
          </p>
          <p className="text-xs text-[#171f38]/35 font-light">
            Entre em contato com a Vitti Digital.
          </p>
        </div>
      )}

      {/* ── Conteúdo principal ──────────────────────────────────────────────── */}
      {clientFound && (
        <>
          {/* Último relatório gerado */}
          <div>
            <p className="text-[9px] text-[#455cab]/50 font-light tracking-[0.15em] uppercase mb-3">
              Último relatório
            </p>

            {latestReport ? (
              <div className="rounded-xl border bg-[#f1f1f1] border-[#dfdedf] p-5 flex items-start gap-4">
                {/* Ícone */}
                <div className="w-12 h-12 rounded-xl bg-[#455cab]/[0.08] border border-[#455cab]/[0.15] flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-[#455cab]/70" />
                </div>

                {/* Informações */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-light text-[#171f38] leading-snug">
                    {latestReport.title}
                  </p>
                  <p className="text-[11px] text-[#171f38]/55 font-light mt-0.5">
                    {latestReport.period}
                  </p>
                  {latestReport.summary && (
                    <p className="text-[11px] text-[#171f38]/45 font-light mt-1.5 leading-relaxed line-clamp-2">
                      {latestReport.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-[10px] text-[#171f38]/35 font-light">
                      Publicado em {formatDate(latestReport.createdAt)}
                    </span>
                    {latestReport.fileName && (
                      <span className="text-[10px] text-[#171f38]/30 font-light truncate max-w-[200px]">
                        {latestReport.fileName}
                        {latestReport.fileSize
                          ? ` · ${formatFileSize(latestReport.fileSize)}`
                          : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Botão de download */}
                {downloadUrls[latestReport.id] && (
                  <a
                    href={downloadUrls[latestReport.id]!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#455cab] text-white text-[11px] font-light hover:bg-[#3f4d87] transition-colors shrink-0"
                  >
                    <Download size={12} />
                    Baixar
                  </a>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#dfdedf] py-12 flex flex-col items-center justify-center gap-2">
                <FileText size={18} className="text-[#455cab]/20" />
                <p className="text-sm font-light text-[#171f38]/40">
                  Nenhum relatório disponível no momento
                </p>
                <p className="text-[11px] text-[#171f38]/25 font-light">
                  Novos relatórios serão publicados em breve
                </p>
              </div>
            )}
          </div>

          {/* Histórico de Relatórios */}
          {allReports.length > 0 && (
            <div>
              <div className="rounded-xl border bg-[#f1f1f1] border-[#dfdedf] overflow-hidden">

                {/* Cabeçalho do histórico */}
                <div className="px-4 py-3.5 border-b border-[#dfdedf]/60 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[11px] font-light text-[#455cab] tracking-wide">
                      Histórico de Relatórios
                    </h4>
                    <span className="text-[9px] text-[#171f38]/35 font-light">
                      {filteredReports.length}{" "}
                      {filteredReports.length === 1 ? "relatório" : "relatórios"}
                    </span>
                  </div>
                  <ReportFilter
                    options={filterOptions}
                    currentValue={currentFilterVal}
                  />
                </div>

                {/* Linhas */}
                {pageReports.length === 0 ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-2">
                    <FileText size={16} className="text-[#455cab]/20" />
                    <p className="text-[11px] font-light text-[#171f38]/40">
                      Nenhum relatório neste período
                    </p>
                  </div>
                ) : (
                  pageReports.map((rep, i) => (
                    <div
                      key={rep.id}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3.5 hover:bg-[#455cab]/[0.02] transition-colors",
                        i < pageReports.length - 1 && "border-b border-[#dfdedf]/60"
                      )}
                    >
                      <FileText size={13} className="text-[#455cab]/40 shrink-0" />

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-light text-[#171f38] truncate">
                          {rep.title}
                        </p>
                        <p className="text-[10px] text-[#171f38]/50 font-light mt-0.5">
                          {rep.period}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-[#171f38]/35 font-light hidden sm:block">
                          {formatDate(rep.createdAt)}
                        </span>
                        {rep.fileName && rep.fileSize && (
                          <span className="text-[9px] text-[#171f38]/25 font-light hidden md:block">
                            {formatFileSize(rep.fileSize)}
                          </span>
                        )}
                        {downloadUrls[rep.id] && (
                          <a
                            href={downloadUrls[rep.id]!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#dfdedf] text-[10px] font-light text-[#455cab]/60 hover:border-[#455cab]/40 hover:text-[#455cab] transition-all"
                          >
                            <Download size={10} />
                            Baixar
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3 px-1">
                  <span className="text-[10px] text-[#171f38]/40 font-light">
                    Página {safePage} de {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    {safePage > 1 ? (
                      <Link
                        href={buildPageUrl(
                          { clientId: clientIdForUrl, year: filterYear, month: filterMonth },
                          safePage - 1
                        )}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#dfdedf] text-[10px] font-light text-[#455cab]/60 hover:text-[#455cab] hover:border-[#455cab]/40 transition-all"
                      >
                        <ChevronLeft size={11} />
                        Anterior
                      </Link>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#dfdedf]/40 text-[10px] font-light text-[#171f38]/20 select-none">
                        <ChevronLeft size={11} />
                        Anterior
                      </span>
                    )}
                    {safePage < totalPages ? (
                      <Link
                        href={buildPageUrl(
                          { clientId: clientIdForUrl, year: filterYear, month: filterMonth },
                          safePage + 1
                        )}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#dfdedf] text-[10px] font-light text-[#455cab]/60 hover:text-[#455cab] hover:border-[#455cab]/40 transition-all"
                      >
                        Próxima
                        <ChevronRight size={11} />
                      </Link>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#dfdedf]/40 text-[10px] font-light text-[#171f38]/20 select-none">
                        Próxima
                        <ChevronRight size={11} />
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
