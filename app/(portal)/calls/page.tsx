import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { listPublishedCalls } from "@/lib/data/calls-client";
import { getNextScheduledCall } from "@/lib/data/scheduled-calls-client";
import type { ClientCallRow } from "@/lib/data/calls-client";
import type { ScheduledCall } from "@/lib/data/scheduled-calls-client";
import { MeetingRequestModal } from "@/components/calls/MeetingRequestModal";
import { CallsHistorySection } from "@/components/calls/CallsHistorySection";
import {
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

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId: urlClientId } = await searchParams;

  const cookieStore = await cookies();
  const activeClientId = cookieStore.get("active_client_id")?.value;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let calls: ClientCallRow[] = [];
  let scheduledCall: ScheduledCall | null = null;
  let isAdmin = false;
  let adminPreview = false;

  if (user) {
    const ctx = await loadUserContext(user.id, activeClientId);
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
      const clientId = ctx.client?.id ?? null;
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
          <CallsHistorySection calls={calls} />
        </>
      )}
    </div>
  );
}
