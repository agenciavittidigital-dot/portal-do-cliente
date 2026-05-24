import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { resolveClientForUser } from "@/lib/data/invoices-client";
import { listPublishedCalls } from "@/lib/data/calls-client";
import type { ClientCallRow } from "@/lib/data/calls-client";

export interface CallsResponse {
  success: boolean;
  calls?: ClientCallRow[];
  error?: string;
}

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json<CallsResponse>(
      { success: false, error: "Não autenticado." },
      { status: 401 }
    );
  }

  const ctx = await loadUserContext(user.id);
  const clientId = ctx.client?.id ?? (await resolveClientForUser(user.id));
  if (!clientId) {
    return NextResponse.json<CallsResponse>({ success: true, calls: [] });
  }

  const calls = await listPublishedCalls(clientId);
  return NextResponse.json<CallsResponse>({ success: true, calls });
}
