"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface CalendarioContentItem {
  id: string;
  title: string;
  category: { name: string; color: string };
  status: { name: string; color: string };
  scheduledAt: string;
}

interface CalendarioViewProps {
  items?: CalendarioContentItem[];
  onSelectItem?: (item: CalendarioContentItem) => void;
  onAddItem?: (date: string) => void;
}

export function CalendarioView({
  items = [],
  onSelectItem,
  onAddItem,
}: CalendarioViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const itemsByDate = new Map<string, CalendarioContentItem[]>();
  for (const item of items) {
    const key = item.scheduledAt.slice(0, 10);
    if (!itemsByDate.has(key)) itemsByDate.set(key, []);
    itemsByDate.get(key)!.push(item);
  }

  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors text-vitti-fg-muted hover:text-vitti-blue"
          title="Mês anterior"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-light text-vitti-blue min-w-[150px] text-center tracking-wide">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors text-vitti-fg-muted hover:text-vitti-blue"
          title="Próximo mês"
        >
          <ChevronRight size={15} />
        </button>
        {!isCurrentMonth && (
          <button
            onClick={goToday}
            className="ml-1 px-2.5 py-1 rounded-lg border border-black/[0.08] text-[10px] font-light text-vitti-fg-muted hover:border-vitti-blue/30 hover:text-vitti-blue transition-all"
          >
            Hoje
          </button>
        )}
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-black/[0.06] bg-black/[0.015]">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-2.5 text-center text-[10px] font-medium text-vitti-fg-muted/50 tracking-widest uppercase"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) {
              return (
                <div
                  key={`pad-${idx}`}
                  className={cn(
                    "min-h-[108px] border-r border-b border-black/[0.04]",
                    "bg-black/[0.01]",
                    idx % 7 === 6 && "border-r-0"
                  )}
                />
              );
            }

            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayItems = itemsByDate.get(dateStr) ?? [];
            const isToday =
              day === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();
            const colIdx = (firstWeekday + day - 1) % 7;

            return (
              <div
                key={dateStr}
                className={cn(
                  "min-h-[108px] p-1.5 flex flex-col gap-1 border-r border-b border-black/[0.04] group transition-colors",
                  colIdx === 6 && "border-r-0",
                  isToday ? "bg-vitti-blue/[0.025]" : "hover:bg-black/[0.012]"
                )}
              >
                {/* Day number row */}
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={cn(
                      "text-[11px] font-light w-5 h-5 flex items-center justify-center rounded-full leading-none",
                      isToday
                        ? "bg-vitti-blue text-white font-medium text-[10px]"
                        : "text-vitti-fg-muted/60"
                    )}
                  >
                    {day}
                  </span>
                  {onAddItem && (
                    <button
                      onClick={() => onAddItem(dateStr)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-vitti-blue/10 transition-all text-vitti-blue/40 hover:text-vitti-blue"
                      title="Adicionar conteúdo"
                    >
                      <Plus size={11} />
                    </button>
                  )}
                </div>

                {/* Content mini cards */}
                {dayItems.slice(0, 3).map((item) => {
                  const timeStr = (() => {
                    try {
                      const t = new Date(item.scheduledAt).toLocaleTimeString(
                        "pt-BR",
                        { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }
                      );
                      return t === "00:00" ? "" : t;
                    } catch { return ""; }
                  })();
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectItem?.(item)}
                      className="text-left w-full text-[9px] rounded-[3px] px-1.5 py-1 leading-tight hover:opacity-75 transition-opacity"
                      style={{
                        backgroundColor: `${item.category.color}14`,
                        borderLeft: `2px solid ${item.category.color}`,
                        color: item.category.color,
                      }}
                      title={item.title}
                    >
                      <div className="truncate font-medium">{item.title}</div>
                      {timeStr && (
                        <div className="text-[8px] opacity-65 mt-0.5">{timeStr}</div>
                      )}
                    </button>
                  );
                })}

                {dayItems.length > 3 && (
                  <span className="text-[9px] text-vitti-fg-muted/45 pl-0.5 font-light">
                    +{dayItems.length - 3} mais
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
