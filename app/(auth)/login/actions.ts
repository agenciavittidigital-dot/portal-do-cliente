"use server";

import { createClient } from "@/lib/supabase/server";
import { listUserClients } from "@/lib/data/user-context";
import { redirect } from "next/navigation";

export type AuthState = { error: string | null };

export async function signIn(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return { error: "Preencha e-mail e senha para continuar." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !user) {
    return { error: "Credenciais inválidas. Verifique e-mail e senha." };
  }

  // Count client portals to decide where to redirect.
  // null  → vitti_admin   → go straight to /dashboard
  // []    → no clients    → /selecionar-portal (shows "nenhum portal disponível")
  // [one] → 1 client      → /dashboard (backward-compat, no selection needed)
  // [..+] → 2+ clients    → /selecionar-portal (show selection screen)
  const clients = await listUserClients(user.id);

  if (clients !== null && clients.length !== 1) {
    redirect("/selecionar-portal");
  }

  redirect("/dashboard");
}
