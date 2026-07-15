import { cookies } from "next/headers";
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

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CalendarioEditorialListaPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const activeClientId = cookieStore.get("active_client_id")?.value;
  const ctx = await loadUserContext(user.id, activeClientId);

  const isAdmin = ctx.isAdmin;

  // client_user sem cliente vinculado não tem o que ver
  if (!isAdmin && !ctx.client) redirect("/dashboard");

  const [adminClientsList, categories, statuses, responsibles, contents] =
    await Promise.all([
      isAdmin ? listAdminClients() : Promise.resolve([]),
      listEditorialCategories(),
      listEditorialStatuses(),
      listEditorialResponsibles(),
      listEditorialContents(isAdmin ? undefined : { clientId: ctx.client!.id }),
    ]);

  const clients = adminClientsList.map((c) => ({ id: c.id, name: c.name }));

  const p = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const initialFilters = {
    client:     str(p.client),
    category:   str(p.category),
    status:     str(p.status),
    datePreset: str(p.datePreset) || "all",
    startDate:  str(p.startDate),
    endDate:    str(p.endDate),
  };

  return (
    <CalendarioEditorialShell
      view="lista"
      isAdmin={isAdmin}
      clients={clients}
      categories={categories}
      statuses={statuses}
      responsibles={responsibles}
      contents={contents}
      initialFilters={initialFilters}
    />
  );
}
