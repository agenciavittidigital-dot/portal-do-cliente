import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./send-email";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nlToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

export interface NotifyEditorialCommentParams {
  contentId: string;
  authorName: string;
  message: string;
  recipientProfileIds: string[];
}

export async function notifyNewEditorialComment({
  contentId,
  authorName,
  message,
  recipientProfileIds,
}: NotifyEditorialCommentParams): Promise<void> {
  try {
    if (!recipientProfileIds.length) {
      console.warn("[notify-editorial-comment] Nenhum destinatário fornecido.");
      return;
    }

    const admin = createAdminClient();

    // 1. Fetch content title and client_id
    const { data: content, error: contentError } = await admin
      .from("editorial_contents")
      .select("title, client_id")
      .eq("id", contentId)
      .maybeSingle();

    if (contentError || !content) {
      console.warn("[notify-editorial-comment] Conteúdo não encontrado:", contentId);
      return;
    }

    const { title, client_id: clientId } = content;

    // 2. Fetch client name
    const { data: client, error: clientError } = await admin
      .from("clients")
      .select("name")
      .eq("id", String(clientId))
      .maybeSingle();

    if (clientError || !client) {
      console.error("[notify-editorial-comment] Cliente não encontrado para client_id:", String(clientId));
      return;
    }

    const clientName = client.name;

    // 3. Fetch name + email for the validated recipient profile IDs
    const { data: profileData, error: profilesError } = await admin
      .from("profiles")
      .select("name, email")
      .in("id", recipientProfileIds)
      .not("email", "is", null);

    if (profilesError) {
      console.error("[notify-editorial-comment] Erro ao buscar profiles:", profilesError.message);
      return;
    }

    if (!profileData?.length) {
      console.warn("[notify-editorial-comment] Nenhum perfil encontrado para os IDs fornecidos.");
      return;
    }

    // 4. Deduplicate by email (case-insensitive)
    const seen = new Set<string>();
    const recipients = profileData.filter((p) => {
      if (!p.email) return false;
      const key = p.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!recipients.length) return;

    // 5. Send one email per recipient, each isolated
    const safeSubjectTitle = String(title).replace(/[\r\n]+/g, " ");
    const subject = `Nova consideração — ${safeSubjectTitle}`;
    const portalUrl = "https://portaldoparceiro.vittidigital.com/calendario-editorial/lista";

    for (const recipient of recipients) {
      try {
        const html = buildEmailHtml({
          recipientName: String(recipient.name ?? recipient.email),
          clientName: String(clientName),
          contentTitle: String(title),
          message,
          authorName,
          portalUrl,
        });

        await sendEmail({ to: recipient.email!, subject, html });
      } catch (sendErr) {
        console.error("[notify-editorial-comment] Falha ao enviar para destinatário:", sendErr);
      }
    }
  } catch (err) {
    console.error("[notify-editorial-comment] Erro inesperado na notificação:", err);
  }
}

interface EmailHtmlParams {
  recipientName: string;
  clientName: string;
  contentTitle: string;
  message: string;
  authorName: string;
  portalUrl: string;
}

function buildEmailHtml({
  recipientName,
  clientName,
  contentTitle,
  message,
  authorName,
  portalUrl,
}: EmailHtmlParams): string {
  const safeRecipient = escapeHtml(recipientName);
  const safeClient = escapeHtml(clientName);
  const safeTitle = escapeHtml(contentTitle);
  const safeMessage = nlToHtml(message);
  const safeAuthor = escapeHtml(authorName);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nova consideração</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#171F38;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#455CAB;padding:24px 32px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;color:rgba(255,255,255,0.65);text-transform:uppercase;">Calendário Editorial</p>
              <h1 style="margin:6px 0 0;font-size:22px;font-weight:300;color:#ffffff;letter-spacing:-0.02em;">Nova consideração</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px;font-size:15px;color:#c8d0e0;line-height:1.6;">
                Olá, <strong style="color:#ffffff;font-weight:500;">${safeRecipient}</strong>.
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#8a96a8;line-height:1.7;">
                Uma nova consideração foi adicionada no Calendário Editorial de
                <strong style="color:#c8d0e0;">${safeClient}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1526;border-radius:8px;overflow:hidden;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #1e2a45;">
                    <p style="margin:0 0 5px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#638ACC;">Conteúdo</p>
                    <p style="margin:0;font-size:14px;color:#ffffff;line-height:1.5;">${safeTitle}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #1e2a45;">
                    <p style="margin:0 0 5px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#638ACC;">Consideração</p>
                    <p style="margin:0;font-size:14px;color:#ffffff;line-height:1.7;">${safeMessage}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 5px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#638ACC;">Adicionada por</p>
                    <p style="margin:0;font-size:14px;color:#ffffff;line-height:1.5;">${safeAuthor}</p>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="${portalUrl}"
                       style="display:inline-block;padding:12px 28px;background:#455CAB;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;border-radius:6px;letter-spacing:0.02em;">
                      Ver no Portal
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #1e2a45;">
              <p style="margin:0;font-size:11px;color:#3a4560;line-height:1.5;">
                Mensagem enviada automaticamente pelo Portal do Parceiro Vitti Digital.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
