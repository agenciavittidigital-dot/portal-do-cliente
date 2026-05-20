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
      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 bg-vitti-dark/30">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-vitti-blue/15 border border-vitti-blue/20 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-light text-vitti-light/80">{initial}</span>
          </div>
          <div>
            <p className="text-[10px] text-white/25 font-light tracking-widest uppercase">
              Visualizando
            </p>
            <p className="text-sm font-light text-white/80">
              {client?.name ?? selectedClientId}
            </p>
          </div>
        </div>
        <Link
          href="/metricas"
          className="flex items-center gap-1.5 text-[11px] font-light text-white/30 hover:text-white/60 transition-colors"
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
        <p className="text-sm font-light text-white/55">Selecione um cliente</p>
        <p className="text-xs text-white/25 font-light mt-1 leading-relaxed">
          Escolha um cliente para visualizar a estrutura de dados e métricas.
        </p>
      </div>

      {loadError ? (
        // Erro ao carregar — distinto de lista vazia
        <div className="py-14 flex flex-col items-center gap-3 rounded-xl border border-dashed border-red-500/10">
          <AlertCircle size={16} className="text-red-400/30" />
          <div className="text-center space-y-1">
            <p className="text-xs text-white/25 font-light">
              Erro ao carregar clientes.
            </p>
            <p className="text-[11px] text-white/15 font-light">
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
                className="group flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-vitti-dark/40 hover:border-vitti-blue/20 hover:bg-vitti-blue/5 transition-all duration-150"
              >
                <div className="w-9 h-9 rounded-full bg-vitti-blue/10 border border-vitti-blue/15 flex items-center justify-center shrink-0 group-hover:bg-vitti-blue/20 transition-colors">
                  <span className="text-sm font-light text-vitti-light/60 group-hover:text-vitti-light transition-colors">
                    {initial}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-light text-white/65 group-hover:text-white/90 transition-colors truncate">
                    {client.name}
                  </p>
                  <p className="text-[11px] text-white/20 font-light truncate mt-0.5">
                    {client.segment ?? client.slug}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        // Lista realmente vazia
        <div className="py-14 flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/5">
          <Users size={16} className="text-white/15" />
          <p className="text-xs text-white/20 font-light">
            Nenhum cliente ativo cadastrado.
          </p>
        </div>
      )}
    </div>
  );
}
