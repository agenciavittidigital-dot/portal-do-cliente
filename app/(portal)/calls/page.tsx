import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { resolveClientForUser } from "@/lib/data/invoices-client";
import { listPublishedCalls } from "@/lib/data/calls-client";
import { getNextScheduledCall } from "@/lib/data/scheduled-calls-client";
import type { ClientCallRow } from "@/lib/data/calls-client";
import type { ScheduledCall } from "@/lib/data/scheduled-calls-client";
import { MeetingRequestModal } from "@/components/calls/MeetingRequestModal";
import { Badge } from "@/components/ui/Badge";
import {
  Phone,
  ExternalLink,
  Clock,
  Video,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Send,
} from "lucide-react";
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

function formatScheduledAt(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      time: d.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  } catch {
    return { date: iso.slice(0, 10), time: "—" };
  }
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
  let scheduledCall: ScheduledCall | null = null;
  let isAdmin = false;
  let adminPreview = false;

  if (user) {
    const ctx = await loadUserContext(user.id);
    isAdmin = ctx.isAdmin;

    if (isAdmin) {
      if (urlClientId) {
        adminPreview = true;
        [calls, scheduledCall] = await Promise.all([
          listPublishedCalls(urlClientId),
          getNextScheduledCall(urlClientId),
        ]);
      }
    } else {
      const clientId = ctx.client?.id ?? (await resolveClientForUser(user.id));
      if (clientId) {
        [calls, scheduledCall] = await Promise.all([
          listPublishedCalls(clientId),
          getNextScheduledCall(clientId),
        ]);
      }
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-vitti-fg">Calls</h2>
        <p className="text-sm text-vitti-fg-muted mt-0.5">
          Reuniões, solicitações e gravações com a equipe Vitti
        </p>
      </div>

      {/* Admin sem clientId */}
      {isAdmin && !adminPreview && (
        <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] px-5 py-6 flex flex-col items-center gap-3 text-center">
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

      {/* Banner admin preview */}
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

      {/* Conteúdo principal */}
      {(!isAdmin || adminPreview) && (
        <>
          {/* Blocos superiores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Bloco 1: Solicitar reunião */}
            <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-5 flex flex-col">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
                  <Send size={13} className="text-vitti-light/60" />
                </div>
                <p className="text-sm font-semibold text-vitti-fg">
                  Solicitar reunião com a Vitti
                </p>
              </div>
              <p className="text-[11px] text-vitti-fg-muted font-light leading-relaxed">
                Envie uma solicitação para alinhar estratégias, dúvidas ou próximos passos
                com nosso time.
              </p>

              {!isAdmin ? (
                <MeetingRequestModal />
              ) : (
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-light text-vitti-fg-muted/40 cursor-default self-start">
                  <Send size={11} />
                  Disponível apenas para clientes
                </div>
              )}
            </div>

            {/* Bloco 2: Reunião agendada */}
            <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-5 flex flex-col">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
                  <CalendarClock size={13} className="text-vitti-light/60" />
                </div>
                <p className="text-sm font-semibold text-vitti-fg">
                  Reunião agendada
                </p>
              </div>

              {scheduledCall ? (
                <div className="space-y-3 flex-1">
                  <div>
                    <p className="text-sm font-light text-vitti-blue leading-snug">
                      {scheduledCall.title}
                    </p>
                    <p className="text-[10px] text-vitti-fg-muted mt-0.5">
                      {TYPE_LABELS[scheduledCall.callType] ?? scheduledCall.callType}
                    </p>
                  </div>

                  {(() => {
                    const { date, time } = formatScheduledAt(scheduledCall.scheduledAt);
                    return (
                      <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-vitti-fg-muted font-light">
                          <CalendarDays size={11} className="text-vitti-fg-muted/60" />
                          {date}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-vitti-fg-muted font-light">
                          <Clock size={11} className="text-vitti-fg-muted/60" />
                          {time}
                        </span>
                      </div>
                    );
                  })()}

                  {scheduledCall.meetingUrl && (
                    <a
                      href={scheduledCall.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto inline-flex items-center gap-1.5 self-start px-3 py-1.5 text-[11px] font-light bg-vitti-blue text-white rounded-lg hover:bg-vitti-blue/90 transition-all"
                    >
                      <ExternalLink size={11} />
                      Acessar reunião
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-5 text-center gap-2">
                  <CalendarClock size={22} className="text-vitti-blue/15" />
                  <p className="text-[11px] text-vitti-blue/50 font-light">
                    Nenhuma reunião agendada no momento.
                  </p>
                  <p className="text-[10px] text-vitti-blue/35 font-light leading-relaxed max-w-[200px]">
                    Quando uma nova reunião for confirmada pela equipe Vitti, ela aparecerá aqui.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Histórico de reuniões gravadas */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-vitti-fg">
                Histórico de reuniões gravadas
              </p>
              {calls.length > 0 && (
                <Badge label={`${calls.length}`} variant="default" />
              )}
            </div>

            {calls.length === 0 ? (
              <div className="border border-dashed border-vitti-gray/[0.20] rounded-xl flex flex-col items-center justify-center py-12 gap-3">
                <Video size={24} className="text-vitti-blue/20" />
                <p className="text-[11px] text-vitti-blue/40 font-light">
                  Nenhuma reunião gravada disponível ainda.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {calls.map((call) => {
                  const duration = formatDuration(call.durationMinutes);
                  return (
                    <div
                      key={call.id}
                      className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.10)] transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0 mt-0.5">
                            <Phone size={13} className="text-vitti-light/60" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-light text-vitti-blue truncate">
                              {call.title}
                            </p>
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
          </div>
        </>
      )}
    </div>
  );
}
