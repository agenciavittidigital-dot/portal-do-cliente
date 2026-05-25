import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { testGoogleAdsFields } from "@/lib/integrations/windsor/google-ads-test";
import type { GoogleAdsTestResult } from "@/lib/integrations/windsor/google-ads-test";

export interface GoogleAdsTestApiResponse {
  success: boolean;
  result?: GoogleAdsTestResult;
  error?: string;
}

function err(message: string, status: number) {
  return NextResponse.json<GoogleAdsTestApiResponse>(
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
    const result = await testGoogleAdsFields();
    return NextResponse.json<GoogleAdsTestApiResponse>({ success: true, result });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json<GoogleAdsTestApiResponse>(
      { success: false, error: `Erro no diagnóstico: ${detail}` },
      { status: 500 }
    );
  }
}
