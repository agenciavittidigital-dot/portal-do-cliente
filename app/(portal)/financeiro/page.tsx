import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { resolveClientForUser, listClientInvoices } from "@/lib/data/invoices-client";
import type { ClientInvoiceRow } from "@/lib/data/invoices-client";
import { getSignedDownloadUrl } from "@/lib/storage/portal-files";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  CreditCard,
  FileText,
  ExternalLink,
  Download,
  Barcode,
  Bell,
  Clock,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

function formatCurrency(amount: number | null): string {
  if (amount == null) return "—";
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

function formatReferenceMonth(dateStr: string | null): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length >= 2) {
    const months = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez",
    ];
    const month = months[parseInt(parts[1], 10) - 1] ?? parts[1];
    return `${month}/${parts[0]}`;
  }
  return dateStr;
}

function statusLabel(status: ClientInvoiceRow["status"]): string {
  if (status === "pending") return "Pendente";
  if (status === "cancelled") return "Cancelada";
  return "Emitida";
}

function statusVariant(
  status: ClientInvoiceRow["status"]
): "success" | "warning" | "default" {
  if (status === "issued") return "success";
  if (status === "pending") return "warning";
  return "default";
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId: urlClientId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctx = user ? await loadUserContext(user.id) : null;
  const isAdmin = ctx?.isAdmin ?? false;

  let invoices: ClientInvoiceRow[] = [];
  const downloadUrls: Record<string, string | null> = {};
  let clientFound = false;
  let adminPreview = false;

  if (user) {
    if (isAdmin) {
      // Admin: usa clientId da URL se fornecido — cliente comum nunca entra aqui
      if (urlClientId) {
        adminPreview = true;
        clientFound = true;
        invoices = await listClientInvoices(urlClientId);
        await Promise.all(
          invoices.map(async (inv) => {
            try {
              downloadUrls[inv.id] = await getSignedDownloadUrl(inv.filePath, 3600);
            } catch {
              downloadUrls[inv.id] = null;
            }
          })
        );
      }
    } else {
      // Cliente comum: ignora qualquer clientId da URL, usa sempre o vínculo do usuário
      const clientId = await resolveClientForUser(user.id);
      if (clientId) {
        clientFound = true;
        invoices = await listClientInvoices(clientId);
        await Promise.all(
          invoices.map(async (inv) => {
            try {
              downloadUrls[inv.id] = await getSignedDownloadUrl(inv.filePath, 3600);
            } catch {
              downloadUrls[inv.id] = null;
            }
          })
        );
      }
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide">
          Financeiro
        </h2>
        <p className="text-sm text-white/25 mt-0.5 font-light">
          Central financeira do seu contrato
        </p>
      </div>

      {/* Admin sem clientId → redireciona para o admin */}
      {isAdmin && !adminPreview && (
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <CreditCard size={14} className="text-vitti-light/40 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-light text-white/60">
                  Você está autenticado como administrador Vitti.
                </p>
                <p className="text-xs text-white/25 font-light mt-0.5">
                  Selecione um cliente em Admin → Financeiro e clique em &ldquo;Ver como cliente&rdquo;.
                </p>
              </div>
              <Link
                href="/admin/financeiro"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-vitti-blue/30 text-[11px] font-light text-vitti-light/70 hover:border-vitti-blue/50 hover:text-vitti-light transition-all shrink-0"
              >
                <ExternalLink size={11} />
                Admin Financeiro
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Banner admin em modo preview */}
      {isAdmin && adminPreview && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-vitti-blue/20 bg-vitti-blue/5">
          <span className="text-[10px] font-light text-vitti-light/50">
            Visualização do cliente — modo admin
          </span>
          <Link
            href="/admin/financeiro"
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-light text-vitti-light/50 hover:text-vitti-light/80 transition-colors"
          >
            <ArrowLeft size={9} />
            Voltar ao Admin
          </Link>
        </div>
      )}

      {/* Sem cliente vinculado (cliente comum) */}
      {!isAdmin && !clientFound && (
        <Card>
          <CardContent className="py-8 text-center">
            <CreditCard size={20} className="text-white/10 mx-auto mb-3" />
            <p className="text-sm font-light text-white/30">
              Nenhum cliente vinculado à sua conta.
            </p>
            <p className="text-xs text-white/15 font-light mt-1">
              Entre em contato com a Vitti Digital.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Notas Fiscais — exibe para cliente comum OU admin em preview */}
      {clientFound && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={13} className="text-vitti-light/30" />
                <CardTitle>Notas Fiscais</CardTitle>
              </div>
              <Badge
                label={`${invoices.length} NF${invoices.length !== 1 ? "s" : ""}`}
                variant="info"
              />
            </div>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="py-8 text-center">
                <FileText size={20} className="text-white/10 mx-auto mb-3" />
                <p className="text-sm font-light text-white/25">
                  Nenhuma nota fiscal registrada ainda.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map((nf) => {
                  const url = downloadUrls[nf.id] ?? null;
                  return (
                    <div
                      key={nf.id}
                      className="flex items-center justify-between p-3.5 rounded-lg border border-white/5 hover:border-white/8 hover:bg-white/[0.02] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText size={14} className="text-vitti-light/25 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-light text-white/70 truncate">
                            {nf.title}
                          </p>
                          <p className="text-[11px] text-white/25 font-light mt-0.5">
                            {formatReferenceMonth(nf.referenceMonth)}
                            {nf.issuedAt ? ` · ${formatDate(nf.issuedAt)}` : ""}
                            {nf.invoiceNumber ? ` · NF ${nf.invoiceNumber}` : ""}
                          </p>
                          {nf.description && (
                            <p className="text-[10px] text-white/20 font-light mt-0.5 truncate max-w-xs">
                              {nf.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className="text-sm font-light text-white/40">
                          {formatCurrency(nf.amount)}
                        </span>
                        <Badge
                          label={statusLabel(nf.status)}
                          variant={statusVariant(nf.status)}
                        />
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Baixar nota fiscal"
                            className="p-1.5 text-white/25 hover:text-vitti-light/60 transition-colors"
                          >
                            <Download size={13} />
                          </a>
                        ) : (
                          <span className="p-1.5 text-white/10">
                            <Download size={13} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Em breve — Pagamentos & Boletos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Barcode size={13} className="text-vitti-light/30" />
              <CardTitle>Pagamentos & Boletos</CardTitle>
            </div>
            <Badge label="Em breve" variant="default" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-white/20 font-light text-center py-4">
            Emissão de boletos e acompanhamento de pagamentos em desenvolvimento.
          </p>
        </CardContent>
      </Card>

      {/* Em breve — Histórico */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-vitti-light/25" />
              <CardTitle>Histórico de Pagamentos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-white/15 font-light">Em breve</p>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-vitti-light/25" />
              <CardTitle>Alertas Financeiros</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-white/15 font-light">Em breve</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
