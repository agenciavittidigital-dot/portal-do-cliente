import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { redirect } from "next/navigation";
import { listAdminClients } from "@/lib/data/clients-admin";
import {
  listEditorialContents,
  listEditorialCategories,
  listEditorialStatuses,
  listEditorialResponsibles,
} from "@/lib/data/editorial";
import { CalendarioEditorialShell } from "@/components/calendario-editorial/CalendarioEditorialShell";

export default async function CalendarioEditorialCalendarioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) redirect("/dashboard");

  const [allClients, categories, statuses, responsibles, contents] =
    await Promise.all([
      listAdminClients(),
      listEditorialCategories(),
      listEditorialStatuses(),
      listEditorialResponsibles(),
      listEditorialContents(),
    ]);

  const clients = allClients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <CalendarioEditorialShell
      view="calendario"
      isAdmin
      clients={clients}
      categories={categories}
      statuses={statuses}
      responsibles={responsibles}
      contents={contents}
    />
  );
}
