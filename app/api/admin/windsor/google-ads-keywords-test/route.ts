import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { testGoogleAdsKeywords } from "@/lib/integrations/windsor/google-ads-keywords-test";
import type { KeywordsTestResult } from "@/lib/integrations/windsor/google-ads-keywords-test";

export interface KeywordsTestApiResponse {
  success: boolean;
  result?: KeywordsTestResult;
  error?: string;
}

function err(message: string, status: number) {
  return NextResponse.json<KeywordsTestApiResponse>(
    { success: false, error: message },
    { status }
  );
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return err("Não autenticado.", 401);

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return err("Acesso restrito a administradores Vitti.", 403);

  try {
    const result = await testGoogleAdsKeywords();
    return NextResponse.json<KeywordsTestApiResponse>({ success: true, result });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json<KeywordsTestApiResponse>(
      { success: false, error: `Erro no diagnóstico de keywords: ${detail}` },
      { status: 500 }
    );
  }
}
