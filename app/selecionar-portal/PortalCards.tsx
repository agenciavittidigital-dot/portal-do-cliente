"use client";

import { useTransition } from "react";
import { Building2, ChevronRight, Loader2 } from "lucide-react";
import { selectPortal } from "./actions";
import type { UserClientOption } from "@/lib/data/user-context";

export function PortalCards({ clients }: { clients: UserClientOption[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {clients.map((c) => (
        <PortalCard key={c.clientId} client={c} />
      ))}
    </div>
  );
}

function PortalCard({ client }: { client: UserClientOption }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("clientId", client.clientId);
      await selectPortal(fd);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="w-full text-left rounded-2xl border border-black/[0.07] bg-white shadow-[0_2px_16px_rgb(0,0,0,0.05)] hover:border-vitti-blue/20 hover:shadow-[0_6px_28px_rgb(0,0,0,0.09)] transition-all duration-200 p-6 group cursor-pointer disabled:opacity-60 disabled:cursor-wait"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-vitti-blue/[0.05] border border-vitti-blue/[0.08] flex items-center justify-center shrink-0">
          {pending ? (
            <Loader2 size={16} className="text-vitti-light/60 animate-spin" />
          ) : (
            <Building2 size={16} className="text-vitti-light/60" />
          )}
        </div>
        <ChevronRight
          size={14}
          className="text-vitti-blue/25 group-hover:text-vitti-light/60 transition-colors mt-0.5 shrink-0"
        />
      </div>

      <div className="mt-4 space-y-0.5">
        <p className="text-[13px] font-light text-vitti-blue/90 leading-snug">
          {client.clientName}
        </p>
        {client.clientSegment && (
          <p className="text-[11px] font-light text-vitti-blue/45">
            {client.clientSegment}
          </p>
        )}
      </div>

      <div className="mt-5">
        <span className="inline-flex items-center text-[10px] font-light px-2.5 py-1 rounded-full border border-vitti-blue/20 text-vitti-light/60 bg-vitti-blue/[0.04] group-hover:border-vitti-blue/40 group-hover:text-vitti-light/80 transition-all">
          {pending ? "Acessando..." : "Acessar portal"}
        </span>
      </div>
    </button>
  );
}
