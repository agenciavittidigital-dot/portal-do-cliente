import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { syncGoogleAdsMappedAccounts } from "@/lib/integrations/windsor/google-ads-sync";
import type { GoogleAdsSyncResult } from "@/lib/integrations/windsor/google-ads-sync";

export interface GoogleAdsSyncApiResponse {
  success: boolean;
  result?: GoogleAdsSyncResult;
  error?: string;
}

function err(message: string, status: number) {
  return NextResponse.json<GoogleAdsSyncApiResponse>(
    { success: false, error: message },
    { status }
  );
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return err("Não autenticado.", 401);

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return err("Acesso restrito a administradores Vitti.", 403);

  try {
    const result = await syncGoogleAdsMappedAccounts();
    return NextResponse.json<GoogleAdsSyncApiResponse>({ success: true, result });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json<GoogleAdsSyncApiResponse>(
      { success: false, error: `Erro na sincronização: ${detail}` },
      { status: 500 }
    );
  }
}
