"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Loader2, RefreshCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Recipient {
  id: string;
  name: string | null;
  email: string;
  type: "client_user" | "vitti_admin";
}

interface NotificationRecipientsSelectProps {
  contentId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

export function NotificationRecipientsSelect({
  contentId,
  value,
  onChange,
  className,
}: NotificationRecipientsSelectProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset internal state when contentId changes (new content opened)
  useEffect(() => {
    setRecipients([]);
    setFetched(false);
    setError(false);
    setOpen(false);
    setLoading(false);
  }, [contentId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/admin/editorial/${contentId}/notification-recipients`
      );
      const data = (await res.json()) as {
        success: boolean;
        recipients?: Recipient[];
      };
      if (!res.ok || !data.success) {
        setError(true);
        return;
      }
      setRecipients(data.recipients ?? []);
      setFetched(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  function handleToggleOpen() {
    const nextOpen = !open;
    if (nextOpen && !fetched && !loading) {
      fetchRecipients();
    }
    setOpen(nextOpen);
  }

  function handleToggle(id: string) {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    );
  }

  const count = value.length;

  let triggerText: string;
  if (count === 0) {
    triggerText = "Selecione quem receberá a notificação";
  } else if (count === 1) {
    const rec = recipients.find((r) => r.id === value[0]);
    triggerText = rec ? (rec.name ?? rec.email) : "1 pessoa selecionada";
  } else {
    triggerText = `${count} pessoas selecionadas`;
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <span className="block text-[10px] font-medium text-vitti-fg-muted/65 uppercase tracking-wide mb-1.5">
        Notificar <span className="text-red-400/80">*</span>
      </span>

      <button
        type="button"
        onClick={handleToggleOpen}
        className={cn(
          "w-full flex items-center justify-between gap-2 text-left",
          "border rounded-lg px-3 py-2 bg-white transition-colors",
          "focus:outline-none focus:ring-1 focus:ring-vitti-blue/30",
          count > 0
            ? "text-xs font-light text-vitti-fg border-vitti-blue/30"
            : "text-xs font-light text-vitti-fg-muted/35 border-black/[0.1]"
        )}
      >
        <span className="truncate">{triggerText}</span>
        {loading ? (
          <Loader2 size={11} className="shrink-0 animate-spin text-vitti-fg-muted/40" />
        ) : (
          <ChevronDown
            size={11}
            className={cn(
              "shrink-0 text-vitti-fg-muted/40 transition-transform duration-150",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[60] bg-white border border-black/[0.1] rounded-lg shadow-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 size={12} className="animate-spin text-vitti-fg-muted/40" />
              <span className="text-[11px] font-light text-vitti-fg-muted/50">
                Carregando destinatários...
              </span>
            </div>
          ) : error ? (
            <div className="px-3 py-3 text-center space-y-1.5">
              <p className="text-[11px] font-light text-red-400">
                Não foi possível carregar os destinatários.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fetchRecipients();
                }}
                className="inline-flex items-center gap-1 text-[10px] font-light text-vitti-blue hover:underline"
              >
                <RefreshCw size={9} />
                Tentar novamente
              </button>
            </div>
          ) : recipients.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <Users size={12} className="text-vitti-fg-muted/30" />
              <span className="text-[11px] font-light text-vitti-fg-muted/40">
                Nenhum destinatário disponível.
              </span>
            </div>
          ) : (
            <ul className="max-h-[200px] overflow-y-auto py-1">
              {recipients.map((r) => {
                const selected = value.includes(r.id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => handleToggle(r.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                        selected ? "bg-vitti-blue/[0.05]" : "hover:bg-black/[0.02]"
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center",
                          selected
                            ? "bg-vitti-blue border-vitti-blue"
                            : "border-black/[0.18] bg-white"
                        )}
                      >
                        {selected && (
                          <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                            <path
                              d="M1 2.5L2.8 4.2L6 1"
                              stroke="white"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] font-light text-vitti-fg truncate">
                            {r.name ?? r.email}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-[8px] font-medium px-1 py-0.5 rounded border",
                              r.type === "vitti_admin"
                                ? "bg-purple-50 text-purple-500 border-purple-200/60"
                                : "bg-vitti-blue/[0.07] text-vitti-blue border-vitti-blue/[0.15]"
                            )}
                          >
                            {r.type === "vitti_admin" ? "Vitti" : "Cliente"}
                          </span>
                        </div>
                        {r.name && (
                          <p className="text-[9px] font-light text-vitti-fg-muted/50 truncate">
                            {r.email}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
