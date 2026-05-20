import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { testWindsorFields } from "@/lib/integrations/windsor/fields-test";
import type { FieldsTestResult } from "@/lib/integrations/windsor/fields-test";

export type FieldsTestApiResponse = FieldsTestResult;

function err(message: string, status: number): Response {
  const body: FieldsTestApiResponse = {
    success: false,
    groups: [],
    fieldsAccepted: [],
    fieldsRejected: [],
    sampleRecord: null,
    testedAt: new Date().toISOString(),
    error: message,
  };
  return NextResponse.json<FieldsTestApiResponse>(body, { status });
}

export async function GET(): Promise<Response> {
  // ── Autenticação ──────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return err("Não autenticado.", 401);

  // ── Autorização: somente vitti_admin ──────────────────────────
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return err("Acesso restrito a administradores Vitti.", 403);

  // ── Teste de campos — nunca salva no banco ────────────────────
  const result = await testWindsorFields();

  return NextResponse.json<FieldsTestApiResponse>(result, {
    status: result.success ? 200 : 502,
  });
}
