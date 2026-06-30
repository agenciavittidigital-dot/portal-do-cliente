import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { redirect } from "next/navigation";
import { listBanners } from "@/lib/data/banners-admin";
import { getSignedDownloadUrl } from "@/lib/storage/portal-files";
import { BannersAdminPanel } from "@/components/admin/BannersAdminPanel";
import { Badge } from "@/components/ui/Badge";
import { ImageIcon } from "lucide-react";

export default async function CarrosselHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) redirect("/dashboard");

  const rawBanners = await listBanners();

  const bannersWithUrls = await Promise.all(
    rawBanners.map(async (b) => {
      let signedUrl: string | undefined;
      try {
        signedUrl = await getSignedDownloadUrl(b.storagePath, 3600);
      } catch {
        signedUrl = undefined;
      }
      return { ...b, signedUrl };
    })
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
            <ImageIcon size={14} className="text-vitti-light/60" />
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-light text-vitti-blue tracking-wide">Carrossel da Home</h2>
            <Badge label="Admin" variant="info" />
          </div>
        </div>
        <p className="text-sm text-vitti-blue/50 mt-1.5 font-light">
          Gerencie os banners exibidos no carrossel da Home do Portal do Parceiro.
        </p>
      </div>

      <BannersAdminPanel initialBanners={bannersWithUrls} />
    </div>
  );
}
