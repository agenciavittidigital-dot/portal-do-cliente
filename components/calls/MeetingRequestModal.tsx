"use client";

import { useState, useRef, useEffect } from "react";
import { X, Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

type Shift = "morning" | "afternoon";

interface Toast {
  type: "success" | "error";
  message: string;
}

export function MeetingRequestModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [shift, setShift] = useState<Shift>("morning");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => reasonRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (toast) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 6000);
    }
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast]);

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
    setReason("");
    setShift("morning");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/calls/meeting-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shift, reason: reason.trim() }),
      });

      if (res.ok) {
        handleClose();
        setToast({
          type: "success",
          message:
            "Solicitação enviada com sucesso. A equipe Vitti entrará em contato para confirmar o horário.",
        });
      } else {
        setToast({
          type: "error",
          message:
            "Não foi possível enviar sua solicitação agora. Tente novamente em alguns instantes.",
        });
      }
    } catch {
      setToast({
        type: "error",
        message:
          "Não foi possível enviar sua solicitação agora. Tente novamente em alguns instantes.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          role="alert"
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]",
            "flex items-start gap-3 w-[calc(100%-2rem)] max-w-sm",
            "px-4 py-3 rounded-xl border shadow-xl backdrop-blur-xl",
            "text-sm font-light animate-in fade-in slide-in-from-bottom-2 duration-300",
            toast.type === "success"
              ? "bg-white/95 border-green-200 text-green-800"
              : "bg-white/95 border-red-200 text-red-800"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Fechar notificação"
            className="shrink-0 text-current/40 hover:text-current/70 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Botão de abertura */}
      <Button
        onClick={() => setIsOpen(true)}
        size="sm"
        className="mt-4 self-start text-xs"
      >
        <Send size={12} />
        Solicitar reunião
      </Button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

          {/* Painel */}
          <div className="relative w-full max-w-md rounded-2xl border border-white/80 bg-white/92 backdrop-blur-xl shadow-[0_24px_60px_rgb(0,0,0,0.18)] p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-vitti-fg">
                  Solicitar reunião com a Vitti
                </h3>
                <p className="text-[11px] text-vitti-fg-muted font-light mt-0.5">
                  Preencha os campos abaixo. Nossa equipe entrará em contato para confirmar.
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={loading}
                aria-label="Fechar modal"
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-vitti-fg-muted hover:text-vitti-fg disabled:opacity-40"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Turno */}
              <div>
                <label className="block text-[10px] font-semibold text-vitti-fg-muted uppercase tracking-widest mb-2">
                  Turno preferido
                </label>
                <div className="flex gap-2 p-1 rounded-xl bg-slate-100/80 border border-slate-200/60">
                  {(["morning", "afternoon"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setShift(s)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-light transition-all duration-150",
                        shift === s
                          ? "bg-white text-vitti-blue shadow-sm border border-slate-200/80 font-medium"
                          : "text-vitti-fg-muted hover:text-vitti-fg"
                      )}
                    >
                      {s === "morning" ? "Manhã" : "Tarde"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label
                  htmlFor="meeting-reason"
                  className="block text-[10px] font-semibold text-vitti-fg-muted uppercase tracking-widest mb-2"
                >
                  Motivo
                </label>
                <textarea
                  id="meeting-reason"
                  ref={reasonRef}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Descreva brevemente o motivo da reunião..."
                  rows={4}
                  required
                  disabled={loading}
                  className={cn(
                    "w-full rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2.5",
                    "text-sm font-light text-vitti-fg placeholder:text-vitti-fg-muted/40",
                    "focus:outline-none focus:ring-1 focus:ring-vitti-blue/30 focus:border-vitti-blue/50",
                    "resize-none transition-all disabled:opacity-50"
                  )}
                />
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 py-2 rounded-lg border border-slate-200 text-xs font-light text-vitti-fg-muted hover:border-slate-300 hover:text-vitti-fg transition-all disabled:opacity-40"
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading || !reason.trim()}
                  className="flex-1 text-xs justify-center"
                >
                  {loading ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={12} />
                      Enviar solicitação
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
