"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, List, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { CalendarioView } from "./CalendarioView";
import { ListaEditorialView } from "./ListaEditorialView";
import { ContentDrawer } from "./ContentDrawer";
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

interface CalendarioEditorialShellProps {
  view: "calendario" | "lista";
  isAdmin: boolean;
  clients: ClientOption[];
  categories: CategoryOption[];
  statuses: StatusOption[];
  responsibles: ResponsibleOption[];
  contents: ContentRow[];
}

const FALLBACK_CAT = { name: "Sem categoria", color: "#94A3B8" };
const FALLBACK_ST  = { name: "Sem status",    color: "#94A3B8" };

export function CalendarioEditorialShell({
  view,
  isAdmin,
  clients,
  categories,
  statuses,
  responsibles,
  contents,
}: CalendarioEditorialShellProps) {
  const router = useRouter();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editItem, setEditItem] = useState<DrawerEditItem | null>(null);
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined);

  const filtered = selectedClientId
    ? contents.filter((c) => c.clientId === selectedClientId)
    : contents;

  const calendarItems: CalendarioContentItem[] = filtered
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

  const responsiblesMap = new Map(responsibles.map((r) => [r.id, r.name]));

  const listaItems: ListaContentItem[] = filtered.map((c) => ({
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
              <Badge label="Admin" variant="info" />
            </div>
          </div>
          <p className="text-sm text-vitti-blue/50 mt-1.5 font-light">
            Planejamento e acompanhamento de conteúdos por cliente
          </p>
        </div>

        <button
          onClick={openNew}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-vitti-blue text-white text-xs font-light hover:bg-vitti-blue/90 transition-all"
        >
          <Plus size={12} />
          Novo conteúdo
        </button>
      </div>

      {/* Admin: filtro de cliente */}
      {isAdmin && clients.length > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-black/[0.06] bg-white/50 backdrop-blur-sm w-fit">
          <Users size={13} className="text-vitti-fg-muted/50 shrink-0" />
          <span className="text-[11px] text-vitti-fg-muted/60 font-light shrink-0">
            Cliente:
          </span>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
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

      {/* Sub-tab bar */}
      <div className="flex items-end gap-0 border-b border-black/[0.07]">
        <Link
          href="/calendario-editorial/calendario"
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
          href="/calendario-editorial/lista"
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
          onSelectItem={openEditFromCalendar}
          onAddItem={openNewOnDate}
        />
      )}
      {view === "lista" && (
        <ListaEditorialView
          items={listaItems}
          isAdmin={isAdmin}
          onSelectItem={openEditFromLista}
        />
      )}

      {/* Drawer */}
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
    </div>
  );
}
