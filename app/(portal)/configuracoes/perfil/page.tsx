import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { PerfilForm } from "@/components/configuracoes/PerfilForm";

export const metadata = { title: "Perfil" };

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: raw } = await admin
    .from("profiles")
    .select("id, name, email, avatar_url")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const currentAvatarPath = raw?.avatar_url ? String(raw.avatar_url) : null;

  let initialAvatarUrl: string | null = null;
  if (currentAvatarPath) {
    const { data: signed } = await admin.storage
      .from("avatars")
      .createSignedUrl(currentAvatarPath, 3600);
    initialAvatarUrl = signed?.signedUrl ?? null;
  }

  return (
    <PerfilForm
      authUserId={user.id}
      initialName={raw?.name ? String(raw.name) : ""}
      initialEmail={raw?.email ? String(raw.email) : (user.email ?? "")}
      initialAvatarUrl={initialAvatarUrl}
      currentAvatarPath={currentAvatarPath}
    />
  );
}
