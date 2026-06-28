import "server-only";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { resolveClientForUser } from "@/lib/data/invoices-client";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MeetingRequestResponse {
  success: boolean;
  error?: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json<MeetingRequestResponse>(
      { success: false, error: "Não autenticado." },
      { status: 401 }
    );
  }

  const ctx = await loadUserContext(user.id);

  if (ctx.isAdmin) {
    return NextResponse.json<MeetingRequestResponse>(
      { success: false, error: "Admins não podem solicitar reunião por esta rota." },
      { status: 403 }
    );
  }

  const clientId = ctx.client?.id ?? (await resolveClientForUser(user.id));
  if (!clientId) {
    return NextResponse.json<MeetingRequestResponse>(
      { success: false, error: "Nenhum cliente vinculado à conta." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<MeetingRequestResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const shift =
    b.shift === "morning" || b.shift === "afternoon" ? b.shift : null;
  const reason =
    typeof b.reason === "string" && b.reason.trim() ? b.reason.trim() : null;

  if (!shift) {
    return NextResponse.json<MeetingRequestResponse>(
      { success: false, error: "Turno é obrigatório." },
      { status: 400 }
    );
  }
  if (!reason) {
    return NextResponse.json<MeetingRequestResponse>(
      { success: false, error: "Motivo é obrigatório." },
      { status: 400 }
    );
  }

  const userName = ctx.profile?.name ?? "Usuário";
  const userEmail = ctx.profile?.email ?? user.email ?? "";
  const clientName = ctx.client?.name ?? "—";
  const requestedAt = new Date();

  const admin = createAdminClient();
  const { error: dbError } = await admin.from("meeting_requests").insert({
    client_id: clientId,
    profile_id: ctx.profile?.id ?? null,
    user_name: userName,
    user_email: userEmail,
    client_name: clientName,
    shift,
    reason,
    status: "pending",
    requested_at: requestedAt.toISOString(),
  });

  if (dbError) {
    console.error("[meeting-request] Erro ao salvar:", dbError.message);
    return NextResponse.json<MeetingRequestResponse>(
      { success: false, error: "Erro ao registrar solicitação." },
      { status: 500 }
    );
  }

  const toEmail = process.env.MEETING_REQUEST_TO_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "Portal Vitti <noreply@mail.vitti.digital>";

  if (toEmail && resendKey) {
    const shiftLabel = shift === "morning" ? "Manhã" : "Tarde";
    const dateLabel = requestedAt.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    } as Intl.DateTimeFormatOptions);

    const html = `
      <div style="font-family:sans-serif;font-size:14px;color:#1a1a2e;max-width:520px;">
        <h2 style="font-size:18px;font-weight:600;margin-bottom:16px;">
          Nova solicitação de reunião
        </h2>
        <table cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;">
          <tr style="background:#f5f7ff;">
            <td style="width:160px;font-weight:600;padding:10px 12px;border-bottom:1px solid #e8ecf8;">Nome</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e8ecf8;">${userName}</td>
          </tr>
          <tr>
            <td style="font-weight:600;padding:10px 12px;border-bottom:1px solid #e8ecf8;">E-mail</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e8ecf8;">${userEmail}</td>
          </tr>
          <tr style="background:#f5f7ff;">
            <td style="font-weight:600;padding:10px 12px;border-bottom:1px solid #e8ecf8;">Cliente / Empresa</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e8ecf8;">${clientName}</td>
          </tr>
          <tr>
            <td style="font-weight:600;padding:10px 12px;border-bottom:1px solid #e8ecf8;">Turno preferido</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e8ecf8;">${shiftLabel}</td>
          </tr>
          <tr style="background:#f5f7ff;">
            <td style="font-weight:600;padding:10px 12px;border-bottom:1px solid #e8ecf8;vertical-align:top;">Motivo</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e8ecf8;white-space:pre-line;">${reason}</td>
          </tr>
          <tr>
            <td style="font-weight:600;padding:10px 12px;">Data da solicitação</td>
            <td style="padding:10px 12px;">${dateLabel}</td>
          </tr>
        </table>
        <p style="margin-top:20px;font-size:11px;color:#999;">
          Mensagem enviada automaticamente pelo Portal do Cliente Vitti.
        </p>
      </div>
    `;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `Solicitação de reunião — ${clientName}`,
        html,
      }),
    }).catch((err) => {
      console.error("[meeting-request] Falha ao enviar e-mail:", err);
    });
  }

  return NextResponse.json<MeetingRequestResponse>({ success: true });
}
