"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listUserClients } from "@/lib/data/user-context";

export async function selectPortal(formData: FormData): Promise<void> {
  const clientId = (formData.get("clientId") as string | null)?.trim();
  if (!clientId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Validate that this user actually has access to the requested client
  const clients = await listUserClients(user.id);
  const isValid = clients !== null && clients.some((c) => c.clientId === clientId);
  if (!isValid) redirect("/selecionar-portal");

  const cookieStore = await cookies();
  cookieStore.set("active_client_id", clientId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect("/dashboard");
}
