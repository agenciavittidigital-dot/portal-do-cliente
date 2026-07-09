import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const activeClientId = cookieStore.get("active_client_id")?.value;
  const ctx = await loadUserContext(user.id, activeClientId);

  if (!ctx.isAdmin) redirect("/dashboard");

  return <>{children}</>;
}
