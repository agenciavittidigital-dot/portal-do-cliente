import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { resolveClientForUser } from "@/lib/data/invoices-client";
import { listPublishedCalls } from "@/lib/data/calls-client";
import type { ClientCallRow } from "@/lib/data/calls-client";
import { Badge } from "@/components/ui/Badge";
import { Phone, ExternalLink, Clock, Video, ArrowLeft } from "lucide-react";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  performance:         "Performance",
  alignment:           "Alinhamento",
  planning:            "Planejamento",
  onboarding:          "Onboarding",
  report_presentation: "Apresentação de Relatório",
  other:               "Outro",
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  const parts = iso.split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId: urlClientId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let calls: ClientCallRow[] = [];
  let isAdmin = false;
  let adminPreview = false;

  if (user) {
    const ctx = await loadUserContext(user.id);
    isAdmin = ctx.isAdmin;

    if (isAdmin) {
      if (urlClientId) {
        adminPreview = true;
        calls = await listPublishedCalls(urlClientId);
      }
    } else {
      const clientId = ctx.client?.id ?? (await resolveClientForUser(user.id));
      if (clientId) {
        calls = await listPublishedCalls(clientId);
      }
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-light text-vitti-blue tracking-wide">Calls</h2>
          {calls.length > 0 && (
            <Badge label={`${calls.length}`} variant="default" />
          )}
        </div>
        <p className="text-sm text-vitti-blue/50 mt-0.5 font-light">
          Reuniões e gravações com a equipe Vitti
        </p>
      </div>

      {/* Admin sem clientId na URL */}
      {isAdmin && !adminPreview && (
        <div className="rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] px-5 py-6 flex flex-col items-center gap-3 text-center">
          <Video size={24} className="text-vitti-blue/25" />
          <p className="text-sm font-light text-vitti-blue/50">
            Selecione um cliente no Admin para visualizar as calls.
          </p>
          <Link
            href="/admin/calls"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-vitti-blue/30 text-[11px] font-light text-vitti-blue/70 hover:border-vitti-blue/50 hover:text-vitti-blue transition-all"
          >
            <ArrowLeft size={11} />
            Ir para Admin — Calls
          </Link>
        </div>
      )}

      {/* Banner de visualização admin */}
      {isAdmin && adminPreview && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-vitti-blue/20 bg-vitti-blue/5">
          <span className="text-[10px] font-light text-vitti-blue/60">
            Visualização do cliente — modo admin
          </span>
          <Link
            href="/admin/calls"
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-light text-vitti-blue/60 hover:text-vitti-blue transition-colors"
          >
            <ArrowLeft size={9} />
            Voltar ao Admin
          </Link>
        </div>
      )}

      {/* Conteúdo: admin em preview OU cliente comum */}
      {(!isAdmin || adminPreview) && (
        <>
          {calls.length === 0 ? (
            <div className="border border-dashed border-vitti-gray/[0.20] rounded-xl flex flex-col items-center justify-center py-16 gap-3">
              <Video size={28} className="text-vitti-blue/20" />
              <p className="text-[11px] text-vitti-blue/40 font-light">Nenhuma call disponível no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {calls.map((call) => {
                const duration = formatDuration(call.durationMinutes);
                return (
                  <div
                    key={call.id}
                    className="rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-5 hover:border-vitti-gray/[0.25] hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-vitti-gray/[0.10] border border-vitti-gray/[0.14] flex items-center justify-center shrink-0 mt-0.5">
                          <Phone size={13} className="text-vitti-light/60" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-light text-vitti-blue truncate">{call.title}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-[10px] text-vitti-blue/50 font-light">
                              {TYPE_LABELS[call.callType] ?? call.callType}
                            </span>
                            <span className="text-[10px] text-vitti-blue/30">·</span>
                            <span className="text-[10px] text-vitti-blue/50 font-light">
                              {formatDate(call.callDate)}
                            </span>
                            {duration && (
                              <>
                                <span className="text-[10px] text-vitti-blue/30">·</span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-vitti-blue/50 font-light">
                                  <Clock size={9} />
                                  {duration}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {call.recordingUrl && (
                        <a
                          href={call.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-light border border-vitti-gray/[0.20] rounded-lg text-vitti-blue/60 hover:text-vitti-blue hover:border-vitti-blue/30 transition-all shrink-0"
                        >
                          <ExternalLink size={11} />
                          Gravação
                        </a>
                      )}
                    </div>

                    {(call.description || call.summary) && (
                      <div className="mt-3 pl-11 space-y-2">
                        {call.description && (
                          <p className="text-[11px] text-vitti-blue/60 font-light leading-relaxed">
                            {call.description}
                          </p>
                        )}
                        {call.summary && (
                          <div className="border-l border-vitti-gray/[0.20] pl-3">
                            <p className="text-[9px] text-vitti-blue/40 font-light uppercase tracking-widest mb-1">
                              Resumo
                            </p>
                            <p className="text-[11px] text-vitti-blue/65 font-light leading-relaxed whitespace-pre-line">
                              {call.summary}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
