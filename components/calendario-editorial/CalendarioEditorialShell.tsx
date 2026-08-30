"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  List,
  Plus,
  Users,
  Tag,
  CircleDot,
  CalendarRange,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { CalendarioView } from "./CalendarioView";
import { ListaEditorialView } from "./ListaEditorialView";
import { ContentDrawer } from "./ContentDrawer";
import { ContentViewDrawer } from "./ContentViewDrawer";
import type { CalendarioContentItem } from "./CalendarioView";
import type { ListaContentItem } from "./ListaEditorialView";
import type { DrawerEditItem } from "./ContentDrawer";

// Plain serializable types (passed from server components via props)
export interface ContentRow {
  id: string;
  clientId: string;
  clientName: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  statusId: string | null;
  statusName: string | null;
  statusColor: string | null;
  title: string;
  description: string | null;
  caption: string | null;
  scheduledAt: string | null;
  deliveryAt: string | null;
  responsibleId: string | null;
  videoUrl: string | null;
  attachmentCount: number;
  commentCount: number;
  platforms: string[];
}

export interface CategoryOption { id: string; name: string; color: string }
export interface StatusOption   { id: string; name: string; color: string }
export interface ClientOption   { id: string; name: string }
export interface ResponsibleOption { id: string; name: string }

export interface InitialFilters {
  client:     string;
  category:   string;
  status:     string;
  datePreset: string;
  startDate:  string;
  endDate:    string;
  month:      string;
}

interface CalendarioEditorialShellProps {
  view: "calendario" | "lista";
  isAdmin: boolean;
  clients: ClientOption[];
  categories: CategoryOption[];
  statuses: StatusOption[];
  responsibles: ResponsibleOption[];
  contents: ContentRow[];
  initialFilters?: InitialFilters;
}

const FALLBACK_CAT = { name: "Sem categoria", color: "#94A3B8" };
const FALLBACK_ST  = { name: "Sem status",    color: "#94A3B8" };

type DatePreset =
  | "all"
  | "week"
  | "next-week"
  | "month"
  | "next-month"
  | "last-7"
  | "last-30"
  | "no-date"
  | "month-picker"
  | "custom";

// ── Month list helpers ──────────────────────────────────────────────────────

const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function generateMonths(): { value: string; label: string }[] {
  const now = new Date();
  const result: { value: string; label: string }[] = [];
  for (let offset = -6; offset <= 18; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTH_NAMES_PT[d.getMonth()]} ${d.getFullYear()}`;
    result.push({ value, label });
  }
  return result;
}

const MONTHS = generateMonths();

function getMonthLabel(value: string): string {
  if (!value) return "Meses";
  const [y, m] = value.split("-").map(Number);
  return `${MONTH_NAMES_PT[m - 1]} ${y}`;
}

function getDateLabel(
  preset: DatePreset,
  selectedMonth: string,
  customStart: string,
  customEnd: string,
): string {
  switch (preset) {
    case "all":          return "Todas as datas";
    case "week":         return "Esta semana";
    case "next-week":    return "Próxima semana";
    case "month":        return "Este mês";
    case "next-month":   return "Próximo mês";
    case "last-7":       return "Últimos 7 dias";
    case "last-30":      return "Últimos 30 dias";
    case "no-date":      return "Sem data de postagem";
    case "month-picker": return getMonthLabel(selectedMonth);
    case "custom":
      if (customStart && customEnd) return `${customStart} – ${customEnd}`;
      if (customStart) return `A partir de ${customStart}`;
      if (customEnd)   return `Até ${customEnd}`;
      return "Personalizado";
    default: return "Data";
  }
}

// ── Date filter logic (always uses scheduledAt / Data da Postagem) ──────────

function applyDateFilter(
  scheduledAt: string | null,
  preset: DatePreset,
  customStart: string,
  customEnd: string,
  selectedMonth: string,
): boolean {
  if (preset === "all") return true;

  // "Sem data de postagem" — must have null scheduledAt
  if (preset === "no-date") return scheduledAt === null;

  // All remaining presets require a date
  if (!scheduledAt) return false;

  const d   = new Date(scheduledAt);
  const now = new Date();

  if (preset === "week") {
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    thisMonday.setHours(0, 0, 0, 0);
    const thisSunday = new Date(thisMonday);
    thisSunday.setDate(thisMonday.getDate() + 6);
    thisSunday.setHours(23, 59, 59, 999);
    return d >= thisMonday && d <= thisSunday;
  }

  if (preset === "next-week") {
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    thisMonday.setHours(0, 0, 0, 0);
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    nextSunday.setHours(23, 59, 59, 999);
    return d >= nextMonday && d <= nextSunday;
  }

  if (preset === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  if (preset === "next-month") {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return d.getFullYear() === next.getFullYear() && d.getMonth() === next.getMonth();
  }

  if (preset === "last-7") {
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 7);
    cutoff.setHours(0, 0, 0, 0);
    return d >= cutoff;
  }

  if (preset === "last-30") {
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 30);
    cutoff.setHours(0, 0, 0, 0);
    return d >= cutoff;
  }

  if (preset === "month-picker") {
    if (!selectedMonth) return true;
    const [y, m] = selectedMonth.split("-").map(Number);
    return d.getFullYear() === y && d.getMonth() === m - 1;
  }

  if (preset === "custom") {
    const start = customStart ? new Date(customStart + "T00:00:00") : null;
    const end   = customEnd   ? new Date(customEnd   + "T23:59:59") : null;
    if (start && d < start) return false;
    if (end   && d > end)   return false;
    return true;
  }

  return true;
}

// ── Main component ──────────────────────────────────────────────────────────

export function CalendarioEditorialShell({
  view,
  isAdmin,
  clients,
  categories,
  statuses,
  responsibles,
  contents,
  initialFilters,
}: CalendarioEditorialShellProps) {
  const router = useRouter();

  const [selectedClientId,   setSelectedClientId]   = useState(initialFilters?.client     ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialFilters?.category   ?? "");
  const [selectedStatusId,   setSelectedStatusId]   = useState(initialFilters?.status     ?? "");
  const [datePreset,         setDatePreset]          = useState<DatePreset>((initialFilters?.datePreset as DatePreset) ?? "all");
  const [customStart,        setCustomStart]         = useState(initialFilters?.startDate  ?? "");
  const [customEnd,          setCustomEnd]           = useState(initialFilters?.endDate    ?? "");
  const [selectedMonth,      setSelectedMonth]       = useState(initialFilters?.month      ?? "");

  // Date dropdown UI state
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [monthsExpanded,   setMonthsExpanded]   = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // Drawer state
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [editItem,       setEditItem]       = useState<DrawerEditItem | null>(null);
  const [initialDate,    setInitialDate]    = useState<string | undefined>(undefined);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewItem,       setViewItem]       = useState<ContentRow | null>(null);

  // Close date dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = selectedClientId
    ? contents.filter((c) => c.clientId === selectedClientId)
    : contents;

  const calendarFiltered = filtered.filter((c) => {
    if (selectedCategoryId && c.categoryId !== selectedCategoryId) return false;
    if (selectedStatusId   && c.statusId   !== selectedStatusId)   return false;
    return true;
  });

  const calendarItems: CalendarioContentItem[] = calendarFiltered
    .filter((c) => c.scheduledAt !== null)
    .map((c) => ({
      id: c.id,
      title: c.title,
      scheduledAt: c.scheduledAt!,
      category: c.categoryName ? { name: c.categoryName, color: c.categoryColor! } : FALLBACK_CAT,
      status:   c.statusName   ? { name: c.statusName,   color: c.statusColor!   } : FALLBACK_ST,
    }));

  const availableCategories = Array.from(
    new Map(
      filtered
        .filter((c) => c.categoryId && c.categoryName)
        .map((c) => [c.categoryId!, { id: c.categoryId!, name: c.categoryName! }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const availableStatuses = Array.from(
    new Map(
      filtered
        .filter((c) => c.statusId && c.statusName)
        .map((c) => [c.statusId!, { id: c.statusId!, name: c.statusName! }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const listaFiltered = filtered.filter((c) => {
    if (selectedCategoryId && c.categoryId !== selectedCategoryId) return false;
    if (selectedStatusId   && c.statusId   !== selectedStatusId)   return false;
    if (!applyDateFilter(c.scheduledAt, datePreset, customStart, customEnd, selectedMonth)) return false;
    return true;
  });

  const responsiblesMap = new Map(responsibles.map((r) => [r.id, r.name]));

  const listaItems: ListaContentItem[] = listaFiltered.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    caption: c.caption,
    responsibleName: c.responsibleId ? (responsiblesMap.get(c.responsibleId) ?? null) : null,
    scheduledAt: c.scheduledAt,
    deliveryAt: c.deliveryAt,
    clientName: c.clientName,
    videoUrl: c.videoUrl,
    attachmentCount: c.attachmentCount,
    commentCount: c.commentCount,
    platforms: c.platforms,
    category: c.categoryName ? { name: c.categoryName, color: c.categoryColor! } : FALLBACK_CAT,
    status:   c.statusName   ? { name: c.statusName,   color: c.statusColor!   } : FALLBACK_ST,
  }));

  // ── Actions ───────────────────────────────────────────────────────────────

  function openNew() {
    setEditItem(null);
    setInitialDate(undefined);
    setDrawerOpen(true);
  }

  function openNewOnDate(date: string) {
    setEditItem(null);
    setInitialDate(date);
    setDrawerOpen(true);
  }

  function openViewFromCalendar(item: CalendarioContentItem) {
    const full = contents.find((c) => c.id === item.id) ?? null;
    if (!full) return;
    setViewItem(full);
    setViewDrawerOpen(true);
  }

  function openEditFromCalendar(item: CalendarioContentItem) {
    const full = contents.find((c) => c.id === item.id) ?? null;
    if (!full) return;
    setEditItem({
      id: full.id,
      clientId: full.clientId,
      categoryId: full.categoryId,
      statusId: full.statusId,
      responsibleId: full.responsibleId,
      title: full.title,
      description: full.description,
      caption: full.caption,
      scheduledAt: full.scheduledAt,
      deliveryAt: full.deliveryAt,
      videoUrl: full.videoUrl,
      platforms: full.platforms,
    });
    setInitialDate(undefined);
    setDrawerOpen(true);
  }

  function openEditFromLista(item: ListaContentItem) {
    const full = contents.find((c) => c.id === item.id) ?? null;
    if (!full) return;
    setEditItem({
      id: full.id,
      clientId: full.clientId,
      categoryId: full.categoryId,
      statusId: full.statusId,
      responsibleId: full.responsibleId,
      title: full.title,
      description: full.description,
      caption: full.caption,
      scheduledAt: full.scheduledAt,
      deliveryAt: full.deliveryAt,
      videoUrl: full.videoUrl,
      platforms: full.platforms,
    });
    setInitialDate(undefined);
    setDrawerOpen(true);
  }

  function openViewFromLista(item: ListaContentItem) {
    const full = contents.find((c) => c.id === item.id) ?? null;
    if (!full) return;
    setViewItem(full);
    setViewDrawerOpen(true);
  }

  function handleSaved() {
    setDrawerOpen(false);
    router.refresh();
  }

  function buildViewHref(basePath: string): string {
    const sp = new URLSearchParams();
    if (selectedClientId)                                      sp.set("client",     selectedClientId);
    if (selectedCategoryId)                                    sp.set("category",   selectedCategoryId);
    if (selectedStatusId)                                      sp.set("status",     selectedStatusId);
    if (datePreset !== "all")                                  sp.set("datePreset", datePreset);
    if (datePreset === "month-picker" && selectedMonth)        sp.set("month",      selectedMonth);
    if (customStart)                                           sp.set("startDate",  customStart);
    if (customEnd)                                             sp.set("endDate",    customEnd);
    const q = sp.toString();
    return `${basePath}${q ? `?${q}` : ""}`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-[1200px]">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
              <CalendarDays size={14} className="text-vitti-light/60" />
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-light text-vitti-blue tracking-wide">
                Calendário Editorial
              </h2>
              {isAdmin && <Badge label="Admin" variant="info" />}
            </div>
          </div>
          <p className="text-sm text-vitti-blue/50 mt-1.5 font-light">
            Planejamento e acompanhamento de conteúdos por cliente
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openNew}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-vitti-blue text-white text-xs font-light hover:bg-vitti-blue/90 transition-all"
          >
            <Plus size={12} />
            Novo conteúdo
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Cliente — admin only */}
        {isAdmin && clients.length > 0 && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-black/[0.06] bg-white/50 backdrop-blur-sm">
            <Users size={13} className="text-vitti-fg-muted/50 shrink-0" />
            <span className="text-[11px] text-vitti-fg-muted/60 font-light shrink-0">Cliente:</span>
            <select
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setSelectedCategoryId("");
                setSelectedStatusId("");
              }}
              className="text-xs font-light text-vitti-fg bg-transparent border-none focus:outline-none focus:ring-0 min-w-[180px] cursor-pointer"
            >
              <option value="">Todos os clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Categoria */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-black/[0.06] bg-white/50 backdrop-blur-sm">
          <Tag size={13} className="text-vitti-fg-muted/50 shrink-0" />
          <span className="text-[11px] text-vitti-fg-muted/60 font-light shrink-0">Categoria:</span>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="text-xs font-light text-vitti-fg bg-transparent border-none focus:outline-none focus:ring-0 min-w-[140px] cursor-pointer"
          >
            <option value="">Todas</option>
            {availableCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-black/[0.06] bg-white/50 backdrop-blur-sm">
          <CircleDot size={13} className="text-vitti-fg-muted/50 shrink-0" />
          <span className="text-[11px] text-vitti-fg-muted/60 font-light shrink-0">Status:</span>
          <select
            value={selectedStatusId}
            onChange={(e) => setSelectedStatusId(e.target.value)}
            className="text-xs font-light text-vitti-fg bg-transparent border-none focus:outline-none focus:ring-0 min-w-[140px] cursor-pointer"
          >
            <option value="">Todos</option>
            {availableStatuses.map((st) => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
        </div>

        {/* Data — lista only, custom dropdown */}
        {view === "lista" && (
          <div className="relative" ref={dateDropdownRef}>
            {/* Trigger button */}
            <button
              type="button"
              onClick={() => {
                const opening = !dateDropdownOpen;
                setDateDropdownOpen(opening);
                // Auto-expand months sub-list when re-opening with a month already selected
                if (opening && datePreset === "month-picker") setMonthsExpanded(true);
              }}
              className={cn(
                "flex items-center gap-2.5 px-4 py-3 rounded-xl border border-black/[0.06] bg-white/50 backdrop-blur-sm transition-colors",
                dateDropdownOpen ? "border-vitti-blue/20 bg-white/80" : "hover:bg-white/80"
              )}
            >
              <CalendarRange size={13} className="text-vitti-fg-muted/50 shrink-0" />
              <span className="text-[11px] text-vitti-fg-muted/60 font-light shrink-0">Data:</span>
              <span className="text-xs font-light text-vitti-fg min-w-[110px] text-left">
                {getDateLabel(datePreset, selectedMonth, customStart, customEnd)}
              </span>
              <ChevronDown
                size={11}
                className={cn(
                  "text-vitti-fg-muted/40 transition-transform shrink-0",
                  dateDropdownOpen && "rotate-180"
                )}
              />
            </button>

            {/* Dropdown panel */}
            {dateDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 z-30 bg-white border border-black/[0.08] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] w-[230px] py-1.5 overflow-hidden">

                {/* Preset options */}
                {(
                  [
                    { value: "all",        label: "Todas as datas" },
                    { value: "week",       label: "Esta semana" },
                    { value: "next-week",  label: "Próxima semana" },
                    { value: "month",      label: "Este mês" },
                    { value: "next-month", label: "Próximo mês" },
                    { value: "last-7",     label: "Últimos 7 dias" },
                    { value: "last-30",    label: "Últimos 30 dias" },
                    { value: "no-date",    label: "Sem data de postagem" },
                  ] as { value: DatePreset; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setDatePreset(opt.value);
                      setSelectedMonth("");
                      setCustomStart("");
                      setCustomEnd("");
                      setMonthsExpanded(false);
                      setDateDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-2 text-xs font-light transition-colors",
                      datePreset === opt.value
                        ? "text-vitti-blue bg-vitti-blue/[0.06]"
                        : "text-vitti-fg hover:bg-black/[0.03]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}

                <div className="my-1 border-t border-black/[0.05]" />

                {/* Meses — expandable sub-list */}
                <div>
                  <button
                    type="button"
                    onClick={() => setMonthsExpanded((v) => !v)}
                    className={cn(
                      "w-full text-left px-4 py-2 text-xs font-light transition-colors flex items-center justify-between",
                      datePreset === "month-picker"
                        ? "text-vitti-blue bg-vitti-blue/[0.06]"
                        : "text-vitti-fg hover:bg-black/[0.03]"
                    )}
                  >
                    <span>Meses</span>
                    <ChevronDown
                      size={11}
                      className={cn(
                        "text-vitti-fg-muted/40 transition-transform",
                        monthsExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {monthsExpanded && (
                    <div className="max-h-[196px] overflow-y-auto border-t border-black/[0.04] bg-black/[0.01]">
                      {MONTHS.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            setDatePreset("month-picker");
                            setSelectedMonth(m.value);
                            setCustomStart("");
                            setCustomEnd("");
                            setDateDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-6 py-1.5 text-xs font-light transition-colors",
                            datePreset === "month-picker" && selectedMonth === m.value
                              ? "text-vitti-blue bg-vitti-blue/[0.06]"
                              : "text-vitti-fg/80 hover:bg-black/[0.03]"
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="my-1 border-t border-black/[0.05]" />

                {/* Personalizado */}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset("custom");
                      setSelectedMonth("");
                      setMonthsExpanded(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-2 text-xs font-light transition-colors",
                      datePreset === "custom"
                        ? "text-vitti-blue bg-vitti-blue/[0.06]"
                        : "text-vitti-fg hover:bg-black/[0.03]"
                    )}
                  >
                    Personalizado
                  </button>

                  {datePreset === "custom" && (
                    <div className="px-4 pb-3 pt-1.5 space-y-2 border-t border-black/[0.04]">
                      <div>
                        <p className="text-[10px] font-light text-vitti-fg-muted/50 mb-1">De</p>
                        <input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="w-full text-xs font-light text-vitti-fg bg-white border border-black/[0.1] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-vitti-blue/30 cursor-pointer"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-light text-vitti-fg-muted/50 mb-1">Até</p>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="w-full text-xs font-light text-vitti-fg bg-white border border-black/[0.1] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-vitti-blue/30 cursor-pointer"
                        />
                      </div>
                      {(customStart || customEnd) && (
                        <button
                          type="button"
                          onClick={() => setDateDropdownOpen(false)}
                          className="w-full text-center text-[10px] font-light text-vitti-blue py-1 border border-vitti-blue/20 rounded-lg hover:text-vitti-blue/70 transition-colors"
                        >
                          Aplicar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sub-tab bar */}
      <div className="flex items-end gap-0 border-b border-black/[0.07]">
        <Link
          href={buildViewHref("/calendario-editorial/calendario")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-xs font-light transition-all border-b-2 -mb-px",
            view === "calendario"
              ? "border-vitti-blue/70 text-[#111111]/90"
              : "border-transparent text-[#5F6368]/60 hover:text-[#111111]/70 hover:border-black/[0.12]"
          )}
        >
          <CalendarDays size={12} />
          Calendário
        </Link>
        <Link
          href={buildViewHref("/calendario-editorial/lista")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-xs font-light transition-all border-b-2 -mb-px",
            view === "lista"
              ? "border-vitti-blue/70 text-[#111111]/90"
              : "border-transparent text-[#5F6368]/60 hover:text-[#111111]/70 hover:border-black/[0.12]"
          )}
        >
          <List size={12} />
          Lista editorial
        </Link>
      </div>

      {/* Content views */}
      {view === "calendario" && (
        <CalendarioView
          items={calendarItems}
          onSelectItem={isAdmin ? openEditFromCalendar : openViewFromCalendar}
          onAddItem={isAdmin ? openNewOnDate : undefined}
        />
      )}
      {view === "lista" && (
        <ListaEditorialView
          items={listaItems}
          isAdmin={isAdmin}
          onSelectItem={isAdmin ? openEditFromLista : openViewFromLista}
        />
      )}

      {/* Drawer de edição — apenas para admin */}
      {isAdmin && (
        <ContentDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSaved={handleSaved}
          categories={categories}
          statuses={statuses}
          clients={clients}
          responsibles={responsibles}
          editItem={editItem}
          initialScheduledAt={initialDate}
        />
      )}

      {/* Drawer de leitura — para todos */}
      <ContentViewDrawer
        open={viewDrawerOpen}
        item={viewItem}
        responsibles={responsibles}
        onClose={() => setViewDrawerOpen(false)}
        isAdmin={isAdmin}
      />
    </div>
  );
}
