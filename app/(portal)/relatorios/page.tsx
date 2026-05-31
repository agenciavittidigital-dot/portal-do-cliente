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
  ArrowLeft,
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
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:border-vitti-gray/[0.25] hover:shadow-md transition-all">
      <div className="w-8 h-8 rounded-lg bg-vitti-gray/[0.10] border border-vitti-gray/[0.14] flex items-center justify-center shrink-0 mt-0.5">
        <FileText size={13} className="text-vitti-light/60" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-light text-vitti-blue leading-snug">{report.title}</p>
            <p className="text-[11px] font-light text-vitti-blue/55 mt-0.5">{report.period}</p>
            {report.fileName && (
              <p className="text-[10px] font-light text-vitti-blue/40 mt-0.5 truncate">
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
                className="flex items-center gap-1 text-[9px] font-light px-2.5 py-1.5 rounded-lg border border-vitti-blue/30 text-vitti-blue/70 hover:border-vitti-blue/60 hover:text-vitti-blue transition-all"
              >
                <Download size={10} />
                Baixar
              </a>
            )}
          </div>
        </div>

        {report.summary && (
          <p className="text-[11px] font-light text-vitti-blue/55 mt-2 leading-relaxed line-clamp-3">
            {report.summary}
          </p>
        )}

        <p className="text-[10px] font-light text-vitti-blue/35 mt-2">
          Publicado em {formatDate(report.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId: urlClientId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctx = user ? await loadUserContext(user.id) : null;
  const isAdmin = ctx?.isAdmin ?? false;

  let reports: ClientReportRow[] = [];
  const downloadUrls: Record<string, string | null> = {};
  let clientFound = false;
  let adminPreview = false;

  if (user) {
    if (isAdmin) {
      if (urlClientId) {
        adminPreview = true;
        clientFound = true;
        reports = await listPublishedReports(urlClientId);
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
    } else {
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
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-light text-vitti-blue tracking-wide">Relatórios</h2>
        <p className="text-sm text-vitti-blue/50 mt-0.5 font-light">
          Seus relatórios mensais e personalizados
        </p>
      </div>

      {/* Admin sem clientId → redireciona para o admin */}
      {isAdmin && !adminPreview && (
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <FileText size={14} className="text-vitti-light/60 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-light text-vitti-blue">
                  Você está autenticado como administrador Vitti.
                </p>
                <p className="text-xs text-vitti-blue/55 font-light mt-0.5">
                  Selecione um cliente em Admin → Relatórios e clique em &ldquo;Ver como cliente&rdquo;.
                </p>
              </div>
              <Link
                href="/admin/relatorios"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-vitti-blue/30 text-[11px] font-light text-vitti-blue/70 hover:border-vitti-blue/50 hover:text-vitti-blue transition-all shrink-0"
              >
                <ExternalLink size={11} />
                Admin Relatórios
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Banner admin em modo preview */}
      {isAdmin && adminPreview && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-vitti-blue/20 bg-vitti-blue/5">
          <span className="text-[10px] font-light text-vitti-blue/60">
            Visualização do cliente — modo admin
          </span>
          <Link
            href="/admin/relatorios"
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-light text-vitti-blue/60 hover:text-vitti-blue transition-colors"
          >
            <ArrowLeft size={9} />
            Voltar ao Admin
          </Link>
        </div>
      )}

      {/* Sem cliente vinculado (cliente comum) */}
      {!isAdmin && !clientFound && (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText size={20} className="text-vitti-blue/20 mx-auto mb-3" />
            <p className="text-sm font-light text-vitti-blue/50">
              Nenhum cliente vinculado à sua conta.
            </p>
            <p className="text-xs text-vitti-blue/35 font-light mt-1">
              Entre em contato com a Vitti Digital.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lista de relatórios */}
      {clientFound && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={13} className="text-vitti-light/60" />
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
                <FileText size={20} className="text-vitti-blue/20 mx-auto mb-3" />
                <p className="text-sm font-light text-vitti-blue/45">
                  Nenhum relatório publicado ainda.
                </p>
                <p className="text-xs text-vitti-blue/30 font-light mt-1">
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
        <p className="text-[9px] text-vitti-blue/40 tracking-[0.2em] uppercase font-light mb-3">
          Em breve
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] px-4 py-3.5 opacity-50">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={12} className="text-vitti-light/50" />
              <span className="text-[11px] font-light text-vitti-blue/60">Geração Automática</span>
            </div>
            <p className="text-[10px] font-light text-vitti-blue/40 leading-relaxed">
              Relatórios gerados automaticamente com base em métricas de performance.
            </p>
          </div>

          <div className="rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] px-4 py-3.5 opacity-50">
            <div className="flex items-center gap-2 mb-1">
              <Mail size={12} className="text-vitti-light/50" />
              <span className="text-[11px] font-light text-vitti-blue/60">Envio por E-mail</span>
            </div>
            <p className="text-[10px] font-light text-vitti-blue/40 leading-relaxed">
              Receba novos relatórios diretamente no seu e-mail.
            </p>
          </div>

          <div className="rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] px-4 py-3.5 opacity-50">
            <div className="flex items-center gap-2 mb-1">
              <Download size={12} className="text-vitti-light/50" />
              <span className="text-[11px] font-light text-vitti-blue/60">Download em PDF</span>
            </div>
            <p className="text-[10px] font-light text-vitti-blue/40 leading-relaxed">
              Exporte qualquer relatório em PDF para compartilhar ou arquivar.
            </p>
          </div>

          <div className="rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] px-4 py-3.5 opacity-50">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={12} className="text-vitti-light/50" />
              <span className="text-[11px] font-light text-vitti-blue/60">Histórico Avançado</span>
            </div>
            <p className="text-[10px] font-light text-vitti-blue/40 leading-relaxed">
              Filtros por período, tipo e comparação entre resultados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
