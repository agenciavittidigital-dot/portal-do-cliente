"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ActionState {
  error: string | null;
  success: boolean;
}

// ── updateProfileName ──────────────────────────────────────────────────────────

export async function updateProfileName(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";

  if (!name) return { error: "Nome não pode estar vazio.", success: false };
  if (name.length > 100) return { error: "Nome muito longo (máx. 100 caracteres).", success: false };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente.", success: false };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ name })
    .eq("auth_user_id", user.id);

  if (error) return { error: "Erro ao atualizar nome. Tente novamente.", success: false };

  revalidatePath("/configuracoes/perfil");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}

// ── updateAvatarPath ───────────────────────────────────────────────────────────

export async function updateAvatarPath(avatarPath: string | null): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada.", success: false };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ avatar_url: avatarPath })
    .eq("auth_user_id", user.id);

  if (error) return { error: "Erro ao salvar foto.", success: false };

  revalidatePath("/configuracoes/perfil");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}

// ── changePassword ─────────────────────────────────────────────────────────────

export async function changePassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentPassword = (formData.get("currentPassword") as string | null) ?? "";
  const newPassword     = (formData.get("newPassword") as string | null) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string | null) ?? "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Preencha todos os campos.", success: false };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Nova senha e confirmação não coincidem.", success: false };
  }
  if (newPassword.length < 6) {
    return { error: "Nova senha deve ter no mínimo 6 caracteres.", success: false };
  }
  if (currentPassword === newPassword) {
    return { error: "A nova senha deve ser diferente da senha atual.", success: false };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Sessão expirada. Faça login novamente.", success: false };

  // Verificar senha atual
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { error: "Senha atual incorreta.", success: false };

  // Atualizar senha
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) return { error: "Erro ao atualizar senha. Tente novamente.", success: false };

  return { error: null, success: true };
}
