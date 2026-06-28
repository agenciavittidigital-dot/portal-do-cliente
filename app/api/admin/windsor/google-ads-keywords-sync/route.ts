import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { syncGoogleAdsKeywords } from "@/lib/integrations/windsor/google-ads-keywords-sync";
import type { KeywordsSyncResult } from "@/lib/integrations/windsor/google-ads-keywords-sync";

export interface KeywordsSyncApiResponse {
  success: boolean;
  result?: KeywordsSyncResult;
  error?: string;
}

function err(message: string, status: number) {
  return NextResponse.json<KeywordsSyncApiResponse>(
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
    const result = await syncGoogleAdsKeywords();
    return NextResponse.json<KeywordsSyncApiResponse>({ success: true, result });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json<KeywordsSyncApiResponse>(
      { success: false, error: `Erro no sync de keywords: ${detail}` },
      { status: 500 }
    );
  }
}
