import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listUserClients } from "@/lib/data/user-context";
import { selectPortal } from "./actions";
import { Building2, ChevronRight } from "lucide-react";

export default async function SelecionarPortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const clients = await listUserClients(user.id);

  // Admin or single-client users should not land here
  if (clients === null) redirect("/dashboard");
  if (clients.length === 1) redirect("/dashboard");

  const hasClients = clients.length > 0;

  return (
    <div className="w-full max-w-2xl space-y-10 py-16">
      {/* Header */}
      <div className="text-center space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-vitti-icon.png"
          alt="Vitti"
          className="h-10 w-auto mx-auto mb-4 object-contain"
        />
        <h1 className="text-2xl font-light text-vitti-blue tracking-tight">
          Selecione um Portal do Parceiro
        </h1>
        <p className="text-sm font-light text-vitti-blue/50">
          {hasClients
            ? "Escolha qual conta deseja acessar."
            : "Nenhum portal disponível para este usuário."}
        </p>
      </div>

      {/* No clients */}
      {!hasClients && (
        <div className="rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-sm px-8 py-12 text-center space-y-2 shadow-[0_2px_16px_rgb(0,0,0,0.04)]">
          <p className="text-sm font-light text-vitti-blue/60">
            Sua conta ainda não está vinculada a nenhum portal.
          </p>
          <p className="text-[11px] font-light text-vitti-blue/40">
            Entre em contato com a equipe Vitti Digital para liberar o acesso.
          </p>
        </div>
      )}

      {/* Client grid */}
      {hasClients && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {clients.map((c) => (
            <form key={c.clientId} action={selectPortal}>
              <input type="hidden" name="clientId" value={c.clientId} />
              <button
                type="submit"
                className="w-full text-left rounded-2xl border border-black/[0.07] bg-white shadow-[0_2px_16px_rgb(0,0,0,0.05)] hover:border-vitti-medium/30 hover:shadow-[0_6px_28px_rgb(0,0,0,0.09)] transition-all duration-200 p-6 group cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-vitti-blue/[0.05] border border-vitti-blue/[0.08] flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-vitti-light/60" />
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-vitti-blue/25 group-hover:text-vitti-light/60 transition-colors mt-0.5 shrink-0"
                  />
                </div>

                <div className="mt-4 space-y-0.5">
                  <p className="text-[13px] font-light text-vitti-blue/90 leading-snug">
                    {c.clientName}
                  </p>
                  {c.clientSegment && (
                    <p className="text-[11px] font-light text-vitti-blue/45">
                      {c.clientSegment}
                    </p>
                  )}
                </div>

                <div className="mt-5">
                  <span className="inline-flex items-center text-[10px] font-light px-2.5 py-1 rounded-full border border-vitti-medium/25 text-vitti-light/60 bg-vitti-medium/[0.04] group-hover:border-vitti-medium/50 group-hover:text-vitti-light/80 transition-all">
                    Acessar portal
                  </span>
                </div>
              </button>
            </form>
          ))}
        </div>
      )}

      <p className="text-center text-[10px] font-light text-vitti-blue/30">
        Vitti Digital — acesso restrito
      </p>
    </div>
  );
}
