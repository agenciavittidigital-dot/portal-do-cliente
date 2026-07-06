"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Inbox,
  Paperclip,
  MessageSquare,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryTag } from "./CategoryTag";
import { StatusBadge } from "./StatusBadge";

export interface ListaContentItem {
  id: string;
  title: string;
  description: string | null;
  caption: string | null;
  responsibleName: string | null;
  category: { name: string; color: string };
  status: { name: string; color: string };
  scheduledAt: string | null;
  deliveryAt: string | null;
  clientName: string;
}

interface ListaEditorialViewProps {
  items?: ListaContentItem[];
  isAdmin?: boolean;
  onSelectItem?: (item: ListaContentItem) => void;
}

// Grid template: Categoria | Cliente | Responsável | Título | Descrição | Legenda |
//               Entrega | Data postagem | Arquivo | Considerações | Status | Chevron
const GRID =
  "78px 108px 108px minmax(130px,1fr) 108px 108px 84px 100px 76px 108px 108px 28px";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

function clip(text: string | null | undefined, len = 52): string {
  if (!text) return "—";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

function FL({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[9px] font-medium text-vitti-fg-muted/50 uppercase tracking-wider mb-1">
      {children}
    </span>
  );
}
function FV({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-light text-vitti-fg leading-relaxed">
      {children}
    </div>
  );
}

const HEADERS = [
  "Categoria",
  "Cliente",
  "Responsável",
  "Título",
  "Descrição",
  "Legenda",
  "Entrega",
  "Data postagem",
  "Arquivo",
  "Considerações",
  "Status",
  "",
];

export function ListaEditorialView({
  items = [],
  onSelectItem,
}: ListaEditorialViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-14 flex flex-col items-center gap-3 text-center">
        <Inbox size={26} className="text-vitti-blue/15" />
        <p className="text-sm font-light text-vitti-blue/50">
          Nenhum conteúdo cadastrado ainda.
        </p>
        <p className="text-xs text-vitti-blue/35 font-light max-w-[260px] leading-relaxed">
          Crie o primeiro conteúdo editorial para que ele apareça aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1200px]">

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div
            className="grid items-center px-4 py-2.5 border-b border-black/[0.06] bg-black/[0.02]"
            style={{ gridTemplateColumns: GRID }}
          >
            {HEADERS.map((h, i) => (
              <span
                key={i}
                className="text-[9px] font-medium text-vitti-fg-muted/50 tracking-wider uppercase pr-2 truncate"
              >
                {h}
              </span>
            ))}
          </div>

          {/* ── Rows ─────────────────────────────────────────────────────── */}
          <div className="divide-y divide-black/[0.04]">
            {items.map((item) => {
              const isExpanded = expandedId === item.id;

              return (
                <div key={item.id}>
                  {/* Collapsed row — click toggles expand */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedId(isExpanded ? null : item.id)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        setExpandedId(isExpanded ? null : item.id);
                    }}
                    className={cn(
                      "grid items-center w-full text-left px-4 py-3 cursor-pointer select-none transition-colors",
                      isExpanded
                        ? "bg-black/[0.012]"
                        : "hover:bg-black/[0.018]"
                    )}
                    style={{ gridTemplateColumns: GRID }}
                  >
                    {/* 1. Categoria */}
                    <div>
                      <CategoryTag
                        name={item.category.name}
                        color={item.category.color}
                        small
                      />
                    </div>

                    {/* 2. Cliente */}
                    <span className="text-[10px] font-light text-vitti-fg truncate pr-2">
                      {item.clientName}
                    </span>

                    {/* 3. Responsável */}
                    <span className="text-[10px] font-light text-vitti-fg-muted truncate pr-2">
                      {item.responsibleName ?? "—"}
                    </span>

                    {/* 4. Título */}
                    <span className="text-xs font-light text-vitti-fg truncate pr-3">
                      {item.title}
                    </span>

                    {/* 5. Descrição */}
                    <span className="text-[10px] font-light text-vitti-fg-muted/70 truncate pr-2">
                      {clip(item.description)}
                    </span>

                    {/* 6. Legenda */}
                    <span className="text-[10px] font-light text-vitti-fg-muted/70 truncate pr-2">
                      {clip(item.caption)}
                    </span>

                    {/* 7. Data de entrega */}
                    <span className="text-[10px] font-light text-vitti-fg-muted pr-2">
                      {formatDate(item.deliveryAt)}
                    </span>

                    {/* 8. Data postagem */}
                    <span className="text-[10px] font-light text-vitti-fg-muted pr-2">
                      {formatDateTime(item.scheduledAt)}
                    </span>

                    {/* 9. Arquivo */}
                    <span className="text-[10px] font-light text-vitti-fg-muted/35 italic pr-2">
                      Sem arquivo
                    </span>

                    {/* 10. Considerações */}
                    <span className="text-[10px] font-light text-vitti-fg-muted/35 italic pr-2">
                      Sem considerações
                    </span>

                    {/* 11. Status */}
                    <div>
                      <StatusBadge
                        name={item.status.name}
                        color={item.status.color}
                        small
                      />
                    </div>

                    {/* Chevron */}
                    <div className="flex items-center justify-center">
                      {isExpanded ? (
                        <ChevronUp size={12} className="text-vitti-fg-muted/40" />
                      ) : (
                        <ChevronDown size={12} className="text-vitti-fg-muted/25" />
                      )}
                    </div>
                  </div>

                  {/* ── Expanded detail panel ───────────────────────────── */}
                  {isExpanded && (
                    <div className="border-t border-black/[0.05] bg-[#f9f9fb] px-6 py-5">
                      <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                        {/* 1. Categoria */}
                        <div>
                          <FL>Categoria</FL>
                          <FV>
                            <CategoryTag
                              name={item.category.name}
                              color={item.category.color}
                            />
                          </FV>
                        </div>

                        {/* 2. Cliente */}
                        <div>
                          <FL>Cliente</FL>
                          <FV>{item.clientName}</FV>
                        </div>

                        {/* 3. Responsável */}
                        <div>
                          <FL>Responsável</FL>
                          <FV>{item.responsibleName ?? "—"}</FV>
                        </div>

                        {/* 4. Título (full width) */}
                        <div className="col-span-3">
                          <FL>Título do post</FL>
                          <FV>{item.title}</FV>
                        </div>

                        {/* 5. Descrição (full width) */}
                        <div className="col-span-3">
                          <FL>Descrição</FL>
                          <FV>
                            {item.description ? (
                              <span className="whitespace-pre-wrap">
                                {item.description}
                              </span>
                            ) : (
                              <span className="text-vitti-fg-muted/40 italic">
                                Sem descrição
                              </span>
                            )}
                          </FV>
                        </div>

                        {/* 6. Legenda (full width) */}
                        <div className="col-span-3">
                          <FL>Legenda</FL>
                          <FV>
                            {item.caption ? (
                              <span className="whitespace-pre-wrap">
                                {item.caption}
                              </span>
                            ) : (
                              <span className="text-vitti-fg-muted/40 italic">
                                Sem legenda
                              </span>
                            )}
                          </FV>
                        </div>

                        {/* 7. Data de entrega */}
                        <div>
                          <FL>Data de entrega</FL>
                          <FV>{formatDate(item.deliveryAt)}</FV>
                        </div>

                        {/* 8. Data e hora da postagem */}
                        <div>
                          <FL>Data e hora da postagem</FL>
                          <FV>{formatDateTime(item.scheduledAt)}</FV>
                        </div>

                        {/* 9. Arquivo */}
                        <div>
                          <FL>Arquivo</FL>
                          <FV>
                            <span className="inline-flex items-center gap-1.5 text-vitti-fg-muted/40 italic">
                              <Paperclip size={11} />
                              Sem arquivo
                            </span>
                          </FV>
                        </div>

                        {/* 10. Considerações (2 cols) */}
                        <div className="col-span-2">
                          <FL>Considerações</FL>
                          <FV>
                            <span className="inline-flex items-center gap-1.5 text-vitti-fg-muted/40 italic">
                              <MessageSquare size={11} />
                              Sem considerações
                            </span>
                          </FV>
                        </div>

                        {/* 11. Status */}
                        <div>
                          <FL>Status</FL>
                          <FV>
                            <StatusBadge
                              name={item.status.name}
                              color={item.status.color}
                            />
                          </FV>
                        </div>
                      </div>

                      {/* Editar button */}
                      <div className="flex justify-end mt-4 pt-4 border-t border-black/[0.05]">
                        <button
                          onClick={() => onSelectItem?.(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-black/[0.1] text-[11px] font-light text-vitti-fg-muted hover:bg-vitti-blue hover:text-white hover:border-vitti-blue transition-all"
                        >
                          <Pencil size={11} />
                          Editar conteúdo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
