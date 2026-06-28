"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CallsAdminPanel } from "@/components/admin/CallsAdminPanel";
import { MeetingRequestsPanel } from "@/components/admin/MeetingRequestsPanel";
import { ScheduledCallsPanel } from "@/components/admin/ScheduledCallsPanel";
import type { AdminClientRow } from "@/lib/data/clients-admin";

type Tab = "requests" | "scheduled" | "recordings";

const TABS: { id: Tab; label: string; description: string }[] = [
  {
    id: "requests",
    label: "Solicitações",
    description: "Pedidos de reunião enviados pelos clientes",
  },
  {
    id: "scheduled",
    label: "Agendamentos",
    description: "Reuniões confirmadas e próximas",
  },
  {
    id: "recordings",
    label: "Gravações",
    description: "Histórico de reuniões publicadas",
  },
];

export function CallsAdminTabs({ allClients }: { allClients: AdminClientRow[] }) {
  const [tab, setTab] = useState<Tab>("requests");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-end gap-0 border-b border-black/[0.07]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-xs font-light transition-all border-b-2 -mb-px",
              tab === t.id
                ? "border-vitti-blue/70 text-[#111111]/90"
                : "border-transparent text-[#5F6368]/60 hover:text-[#111111]/70 hover:border-black/[0.12]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      {tab === "requests" && <MeetingRequestsPanel allClients={allClients} />}
      {tab === "scheduled" && <ScheduledCallsPanel allClients={allClients} />}
      {tab === "recordings" && <CallsAdminPanel allClients={allClients} />}
    </div>
  );
}
