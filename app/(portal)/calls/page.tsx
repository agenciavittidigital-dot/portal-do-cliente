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
      // Admin: só usa clientId da URL — cliente comum nunca entra aqui
      if (urlClientId) {
        adminPreview = true;
        calls = await listPublishedCalls(urlClientId);
      }
    } else {
      // Cliente comum: ignora qualquer clientId da URL, usa sempre o vínculo do usuário
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
          <h2 className="text-xl font-light text-white/90 tracking-wide">Calls</h2>
          {calls.length > 0 && (
            <Badge label={`${calls.length}`} variant="default" />
          )}
        </div>
        <p className="text-sm text-white/25 mt-0.5 font-light">
          Reuniões e gravações com a equipe Vitti
        </p>
      </div>

      {/* Admin sem clientId na URL */}
      {isAdmin && !adminPreview && (
        <div className="border border-white/[0.06] rounded-xl px-5 py-6 bg-white/[0.01] flex flex-col items-center gap-3 text-center">
          <Video size={24} className="text-white/[0.10]" />
          <p className="text-sm font-light text-white/40">
            Selecione um cliente no Admin para visualizar as calls.
          </p>
          <Link
            href="/admin/calls"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-vitti-blue/30 text-[11px] font-light text-vitti-light/70 hover:border-vitti-blue/50 hover:text-vitti-light transition-all"
          >
            <ArrowLeft size={11} />
            Ir para Admin — Calls
          </Link>
        </div>
      )}

      {/* Banner de visualização admin */}
      {isAdmin && adminPreview && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-vitti-blue/20 bg-vitti-blue/5">
          <span className="text-[10px] font-light text-vitti-light/50">
            Visualização do cliente — modo admin
          </span>
          <Link
            href="/admin/calls"
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-light text-vitti-light/50 hover:text-vitti-light/80 transition-colors"
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
            <div className="border border-dashed border-white/[0.06] rounded-xl flex flex-col items-center justify-center py-16 gap-3">
              <Video size={28} className="text-white/[0.07]" />
              <p className="text-[11px] text-white/20 font-light">Nenhuma call disponível no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {calls.map((call) => {
                const duration = formatDuration(call.durationMinutes);
                return (
                  <div
                    key={call.id}
                    className="border border-white/[0.06] rounded-xl p-5 bg-white/[0.01] hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                          <Phone size={13} className="text-vitti-light/40" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-light text-white/80 truncate">{call.title}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-[10px] text-white/30 font-light">
                              {TYPE_LABELS[call.callType] ?? call.callType}
                            </span>
                            <span className="text-[10px] text-white/15">·</span>
                            <span className="text-[10px] text-white/30 font-light">
                              {formatDate(call.callDate)}
                            </span>
                            {duration && (
                              <>
                                <span className="text-[10px] text-white/15">·</span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-white/30 font-light">
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-light border border-white/[0.08] rounded-lg text-white/50 hover:text-white/80 hover:border-white/[0.15] transition-all shrink-0"
                        >
                          <ExternalLink size={11} />
                          Gravação
                        </a>
                      )}
                    </div>

                    {(call.description || call.summary) && (
                      <div className="mt-3 pl-11 space-y-2">
                        {call.description && (
                          <p className="text-[11px] text-white/35 font-light leading-relaxed">
                            {call.description}
                          </p>
                        )}
                        {call.summary && (
                          <div className="border-l border-white/[0.07] pl-3">
                            <p className="text-[9px] text-white/20 font-light uppercase tracking-widest mb-1">
                              Resumo
                            </p>
                            <p className="text-[11px] text-white/40 font-light leading-relaxed whitespace-pre-line">
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
