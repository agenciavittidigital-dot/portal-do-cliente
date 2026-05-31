import Link from "next/link";
import { Users, ArrowLeft, AlertCircle } from "lucide-react";
import type { Client } from "@/types";

interface Props {
  clients: Client[];
  selectedClientId: string | null;
  loadError?: boolean;
}

export function ClientSelector({ clients, selectedClientId, loadError }: Props) {
  // ── Compact strip: cliente já selecionado ─────────────────────
  if (selectedClientId) {
    const client = clients.find((c) => c.id === selectedClientId);
    const initial = (client?.name ?? "C").charAt(0).toUpperCase();

    return (
      <div className="flex items-center justify-between px-4 py-3 rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-vitti-blue/15 border border-vitti-blue/20 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-light text-vitti-blue/80">{initial}</span>
          </div>
          <div>
            <p className="text-[10px] text-vitti-blue/40 font-light tracking-widest uppercase">
              Visualizando
            </p>
            <p className="text-sm font-light text-vitti-blue">
              {client?.name ?? selectedClientId}
            </p>
          </div>
        </div>
        <Link
          href="/metricas"
          className="flex items-center gap-1.5 text-[11px] font-light text-vitti-blue/55 hover:text-vitti-blue transition-colors"
        >
          <ArrowLeft size={11} />
          Alterar cliente
        </Link>
      </div>
    );
  }

  // ── Grid: nenhum cliente selecionado ──────────────────────────
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-light text-vitti-blue">Selecione um cliente</p>
        <p className="text-xs text-vitti-blue/50 font-light mt-1 leading-relaxed">
          Escolha um cliente para visualizar a estrutura de dados e métricas.
        </p>
      </div>

      {loadError ? (
        <div className="py-14 flex flex-col items-center gap-3 rounded-xl border border-dashed border-red-500/10">
          <AlertCircle size={16} className="text-red-400/30" />
          <div className="text-center space-y-1">
            <p className="text-xs text-vitti-blue/45 font-light">
              Erro ao carregar clientes.
            </p>
            <p className="text-[11px] text-vitti-blue/30 font-light">
              Verifique a conexão com o banco e recarregue a página.
            </p>
          </div>
        </div>
      ) : clients.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {clients.map((client) => {
            const initial = client.name.charAt(0).toUpperCase();
            return (
              <Link
                key={client.id}
                href={`/metricas?clientId=${client.id}`}
                className="group flex items-center gap-3 p-4 rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] hover:border-vitti-blue/30 hover:bg-vitti-blue/[0.06] transition-all duration-150"
              >
                <div className="w-9 h-9 rounded-full bg-vitti-blue/10 border border-vitti-blue/15 flex items-center justify-center shrink-0 group-hover:bg-vitti-blue/20 transition-colors">
                  <span className="text-sm font-light text-vitti-blue/60 group-hover:text-vitti-blue transition-colors">
                    {initial}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-light text-vitti-blue/75 group-hover:text-vitti-blue transition-colors truncate">
                    {client.name}
                  </p>
                  <p className="text-[11px] text-vitti-blue/45 font-light truncate mt-0.5">
                    {client.segment ?? client.slug}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-14 flex flex-col items-center gap-3 rounded-xl border border-dashed border-vitti-gray/[0.20]">
          <Users size={16} className="text-vitti-blue/30" />
          <p className="text-xs text-vitti-blue/45 font-light">
            Nenhum cliente ativo cadastrado.
          </p>
        </div>
      )}
    </div>
  );
}
