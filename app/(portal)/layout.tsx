import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadUserContext } from "@/lib/data/user-context";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { NoProfile } from "@/components/portal/NoProfile";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const activeClientId = cookieStore.get("active_client_id")?.value;

  const ctx = user ? await loadUserContext(user.id, activeClientId) : null;

  // Multi-client users without an active selection must choose first
  if (ctx && !ctx.error && !ctx.isAdmin && ctx.clientCount > 1 && !activeClientId) {
    redirect("/selecionar-portal");
  }

  const hasError = !ctx || ctx.error !== null;

  // Generate a short-lived signed URL for the avatar
  let avatarUrl: string | null = null;
  if (!hasError && ctx.profile?.avatar_url) {
    try {
      const admin = createAdminClient();
      const { data: signed } = await admin.storage
        .from("avatars")
        .createSignedUrl(ctx.profile.avatar_url, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    } catch {
      // Avatar display is non-critical — swallow errors silently
    }
  }

  if (hasError) {
    return (
      <div className="flex h-screen bg-vitti-surface overflow-hidden">
        <Sidebar permissions={[]} isAdmin={false} />
        <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="pointer-events-none absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-vitti-light/[0.08] blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-10%] right-[-5%] h-[400px] w-[400px] rounded-full bg-vitti-light/[0.08] blur-3xl" />
          <Topbar
            userEmail={user?.email ?? null}
            userName={null}
            clientName={null}
          />
          <main className="relative z-10 flex-1 overflow-y-auto">
            <NoProfile error={ctx?.error ?? "profile_not_found"} />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-vitti-surface overflow-hidden">
      <Sidebar
        permissions={ctx.permissions}
        isAdmin={ctx.isAdmin}
      />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="pointer-events-none absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-vitti-light/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-10%] right-[-5%] h-[400px] w-[400px] rounded-full bg-vitti-light/[0.08] blur-3xl" />
        <Topbar
          userEmail={user?.email ?? null}
          userName={ctx.profile?.name ?? null}
          clientName={ctx.client?.name ?? null}
          avatarUrl={avatarUrl}
        />
        <main className="relative z-10 flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
