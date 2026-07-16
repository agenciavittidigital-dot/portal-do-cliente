"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, List, Plus, Users, Tag, CircleDot, CalendarRange } from "lucide-react";
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

type DatePreset = "all" | "today" | "week" | "month" | "custom";

function applyDateFilter(
  scheduledAt: string | null,
  preset: DatePreset,
  customStart: string,
  customEnd: string,
): boolean {
  if (preset === "all") return true;
  if (!scheduledAt) return false;
  const d = new Date(scheduledAt);
  const now = new Date();
  if (preset === "today") {
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }
  if (preset === "week") {
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return d >= monday && d <= sunday;
  }
  if (preset === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (preset === "custom") {
    const start = customStart ? new Date(customStart + "T00:00:00") : null;
    const end = customEnd ? new Date(customEnd + "T23:59:59") : null;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  }
  return true;
}

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
  const [selectedClientId, setSelectedClientId] = useState(initialFilters?.client ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialFilters?.category ?? "");
  const [selectedStatusId, setSelectedStatusId] = useState(initialFilters?.status ?? "");
  const [datePreset, setDatePreset] = useState<DatePreset>((initialFilters?.datePreset as DatePreset) ?? "all");
  const [customStart, setCustomStart] = useState(initialFilters?.startDate ?? "");
  const [customEnd, setCustomEnd] = useState(initialFilters?.endDate ?? "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editItem, setEditItem] = useState<DrawerEditItem | null>(null);
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewItem, setViewItem] = useState<ContentRow | null>(null);

  const filtered = selectedClientId
    ? contents.filter((c) => c.clientId === selectedClientId)
    : contents;

  const calendarFiltered = filtered.filter((c) => {
    if (selectedCategoryId && c.categoryId !== selectedCategoryId) return false;
    if (selectedStatusId && c.statusId !== selectedStatusId) return false;
    return true;
  });

  const calendarItems: CalendarioContentItem[] = calendarFiltered
    .filter((c) => c.scheduledAt !== null)
    .map((c) => ({
      id: c.id,
      title: c.title,
      scheduledAt: c.scheduledAt!,
      category: c.categoryName
        ? { name: c.categoryName, color: c.categoryColor! }
        : FALLBACK_CAT,
      status: c.statusName
        ? { name: c.statusName, color: c.statusColor! }
        : FALLBACK_ST,
    }));

  // Derive available filter options from post-client-filter data
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
    if (selectedStatusId && c.statusId !== selectedStatusId) return false;
    if (!applyDateFilter(c.scheduledAt, datePreset, customStart, customEnd)) return false;
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
    category: c.categoryName
      ? { name: c.categoryName, color: c.categoryColor! }
      : FALLBACK_CAT,
    status: c.statusName
      ? { name: c.statusName, color: c.statusColor! }
      : FALLBACK_ST,
  }));

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
    });
    setInitialDate(undefined);
    setDrawerOpen(true);
  }

  function handleSaved() {
    setDrawerOpen(false);
    router.refresh();
  }

  function buildViewHref(basePath: string): string {
    const sp = new URLSearchParams();
    if (selectedClientId)              sp.set("client",     selectedClientId);
    if (selectedCategoryId)            sp.set("category",   selectedCategoryId);
    if (selectedStatusId)              sp.set("status",     selectedStatusId);
    if (datePreset !== "all")          sp.set("datePreset", datePreset);
    if (customStart)                   sp.set("startDate",  customStart);
    if (customEnd)                     sp.set("endDate",    customEnd);
    const q = sp.toString();
    return `${basePath}${q ? `?${q}` : ""}`;
  }

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
        {/* Cliente (admin only) */}
        {isAdmin && clients.length > 0 && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-black/[0.06] bg-white/50 backdrop-blur-sm">
            <Users size={13} className="text-vitti-fg-muted/50 shrink-0" />
            <span className="text-[11px] text-vitti-fg-muted/60 font-light shrink-0">
              Cliente:
            </span>
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
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Categoria (ambas as views) */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-black/[0.06] bg-white/50 backdrop-blur-sm">
          <Tag size={13} className="text-vitti-fg-muted/50 shrink-0" />
          <span className="text-[11px] text-vitti-fg-muted/60 font-light shrink-0">
            Categoria:
          </span>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="text-xs font-light text-vitti-fg bg-transparent border-none focus:outline-none focus:ring-0 min-w-[140px] cursor-pointer"
          >
            <option value="">Todas</option>
            {availableCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status (ambas as views) */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-black/[0.06] bg-white/50 backdrop-blur-sm">
          <CircleDot size={13} className="text-vitti-fg-muted/50 shrink-0" />
          <span className="text-[11px] text-vitti-fg-muted/60 font-light shrink-0">
            Status:
          </span>
          <select
            value={selectedStatusId}
            onChange={(e) => setSelectedStatusId(e.target.value)}
            className="text-xs font-light text-vitti-fg bg-transparent border-none focus:outline-none focus:ring-0 min-w-[140px] cursor-pointer"
          >
            <option value="">Todos</option>
            {availableStatuses.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        {/* Data (only on lista) */}
        {view === "lista" && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-black/[0.06] bg-white/50 backdrop-blur-sm flex-wrap">
            <CalendarRange size={13} className="text-vitti-fg-muted/50 shrink-0" />
            <span className="text-[11px] text-vitti-fg-muted/60 font-light shrink-0">
              Data:
            </span>
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value as DatePreset);
                if (e.target.value !== "custom") {
                  setCustomStart("");
                  setCustomEnd("");
                }
              }}
              className="text-xs font-light text-vitti-fg bg-transparent border-none focus:outline-none focus:ring-0 min-w-[130px] cursor-pointer"
            >
              <option value="all">Todas as datas</option>
              <option value="today">Hoje</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mês</option>
              <option value="custom">Personalizado</option>
            </select>
            {datePreset === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="text-xs font-light text-vitti-fg bg-transparent border border-black/[0.10] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-vitti-blue/30 cursor-pointer"
                />
                <span className="text-[11px] text-vitti-fg-muted/40 font-light">até</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="text-xs font-light text-vitti-fg bg-transparent border border-black/[0.10] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-vitti-blue/30 cursor-pointer"
                />
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
          onSelectItem={isAdmin ? openEditFromLista : undefined}
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
