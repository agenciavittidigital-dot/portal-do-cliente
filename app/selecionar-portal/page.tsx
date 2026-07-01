import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listUserClients } from "@/lib/data/user-context";
import { PortalCards } from "./PortalCards";

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
      {hasClients && <PortalCards clients={clients} />}

      <p className="text-center text-[10px] font-light text-vitti-blue/30">
        Vitti Digital — acesso restrito
      </p>
    </div>
  );
}
