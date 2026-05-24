import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { resolveClientForUser } from "@/lib/data/invoices-client";
import { listPublishedReports } from "@/lib/data/reports-client";
import type { ClientReportRow } from "@/lib/data/reports-client";
import { getSignedDownloadUrl } from "@/lib/storage/portal-files";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  FileText,
  ExternalLink,
  Mail,
  Download,
  Sparkles,
  Clock,
} from "lucide-react";
import Link from "next/link";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

function ReportCard({
  report,
  downloadUrl,
}: {
  report: ClientReportRow;
  downloadUrl: string | null;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:border-white/[0.09] hover:bg-white/[0.03] transition-all">
      <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
        <FileText size={13} className="text-vitti-light/30" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-light text-white/80 leading-snug">{report.title}</p>
            <p className="text-[11px] font-light text-white/35 mt-0.5">{report.period}</p>
            {report.fileName && (
              <p className="text-[10px] font-light text-white/20 mt-0.5 truncate">
                {report.fileName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge label="Disponível" variant="success" />
            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] font-light px-2.5 py-1.5 rounded-lg border border-vitti-medium/30 text-vitti-light/60 hover:border-vitti-medium/60 hover:text-vitti-light/90 transition-all"
              >
                <Download size={10} />
                Baixar
              </a>
            )}
          </div>
        </div>

        {report.summary && (
          <p className="text-[11px] font-light text-white/30 mt-2 leading-relaxed line-clamp-3">
            {report.summary}
          </p>
        )}

        <p className="text-[10px] font-light text-white/15 mt-2">
          Publicado em {formatDate(report.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default async function RelatoriosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctx = user ? await loadUserContext(user.id) : null;
  const isAdmin = ctx?.isAdmin ?? false;

  let reports: ClientReportRow[] = [];
  const downloadUrls: Record<string, string | null> = {};
  let clientFound = false;

  if (user && !isAdmin) {
    const clientId = await resolveClientForUser(user.id);
    if (clientId) {
      clientFound = true;
      reports = await listPublishedReports(clientId);
      await Promise.all(
        reports.map(async (rep) => {
          try {
            downloadUrls[rep.id] = await getSignedDownloadUrl(rep.filePath, 3600);
          } catch {
            downloadUrls[rep.id] = null;
          }
        })
      );
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide">Relatórios</h2>
        <p className="text-sm text-white/25 mt-0.5 font-light">
          Seus relatórios mensais e personalizados
        </p>
      </div>

      {/* Admin notice */}
      {isAdmin && (
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <FileText size={14} className="text-vitti-light/40 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-light text-white/60">
                  Você está autenticado como administrador Vitti.
                </p>
                <p className="text-xs text-white/25 font-light mt-0.5">
                  Cadastre e gerencie relatórios dos clientes na área administrativa.
                </p>
              </div>
              <Link
                href="/admin/relatorios"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-vitti-blue/30 text-[11px] font-light text-vitti-light/70 hover:border-vitti-blue/50 hover:text-vitti-light transition-all"
              >
                <ExternalLink size={11} />
                Admin Relatórios
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client with no linked client */}
      {!isAdmin && !clientFound && (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText size={20} className="text-white/10 mx-auto mb-3" />
            <p className="text-sm font-light text-white/30">
              Nenhum cliente vinculado à sua conta.
            </p>
            <p className="text-xs text-white/15 font-light mt-1">
              Entre em contato com a Vitti Digital.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reports list */}
      {!isAdmin && clientFound && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={13} className="text-vitti-light/30" />
                <CardTitle>Histórico de Relatórios</CardTitle>
              </div>
              <Badge
                label={`${reports.length} relatório${reports.length !== 1 ? "s" : ""}`}
                variant="info"
              />
            </div>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="py-8 text-center">
                <FileText size={20} className="text-white/10 mx-auto mb-3" />
                <p className="text-sm font-light text-white/25">
                  Nenhum relatório publicado ainda.
                </p>
                <p className="text-xs text-white/15 font-light mt-1">
                  Novos relatórios aparecerão aqui quando forem disponibilizados.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((rep) => (
                  <ReportCard
                    key={rep.id}
                    report={rep}
                    downloadUrl={downloadUrls[rep.id] ?? null}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Em breve */}
      <div>
        <p className="text-[9px] text-white/[0.12] tracking-[0.2em] uppercase font-light mb-3">
          Em breve
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3.5 opacity-50">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={12} className="text-vitti-light/20" />
              <span className="text-[11px] font-light text-white/30">Geração Automática</span>
            </div>
            <p className="text-[10px] font-light text-white/15 leading-relaxed">
              Relatórios gerados automaticamente com base em métricas de performance.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3.5 opacity-50">
            <div className="flex items-center gap-2 mb-1">
              <Mail size={12} className="text-vitti-light/20" />
              <span className="text-[11px] font-light text-white/30">Envio por E-mail</span>
            </div>
            <p className="text-[10px] font-light text-white/15 leading-relaxed">
              Receba novos relatórios diretamente no seu e-mail.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3.5 opacity-50">
            <div className="flex items-center gap-2 mb-1">
              <Download size={12} className="text-vitti-light/20" />
              <span className="text-[11px] font-light text-white/30">Download em PDF</span>
            </div>
            <p className="text-[10px] font-light text-white/15 leading-relaxed">
              Exporte qualquer relatório em PDF para compartilhar ou arquivar.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3.5 opacity-50">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={12} className="text-vitti-light/20" />
              <span className="text-[11px] font-light text-white/30">Histórico Avançado</span>
            </div>
            <p className="text-[10px] font-light text-white/15 leading-relaxed">
              Filtros por período, tipo e comparação entre resultados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
