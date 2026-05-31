import { createClient } from "@/lib/supabase/server";
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

  const ctx = user ? await loadUserContext(user.id) : null;

  const hasError = !ctx || ctx.error !== null;

  if (hasError) {
    return (
      <div className="flex h-screen bg-vitti-surface overflow-hidden">
        <Sidebar permissions={[]} isAdmin={false} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar
            userEmail={user?.email ?? null}
            userName={null}
            clientName={null}
          />
          <main className="flex-1 overflow-y-auto">
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
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          userEmail={user?.email ?? null}
          userName={ctx.profile?.name ?? null}
          clientName={ctx.client?.name ?? null}
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white">{children}</main>
      </div>
    </div>
  );
}
