import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { resolveClientForUser, listClientInvoices } from "@/lib/data/invoices-client";
import type { ClientInvoiceRow } from "@/lib/data/invoices-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  CreditCard,
  FileText,
  ExternalLink,
  Barcode,
  Bell,
  Clock,
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

function statusLabel(status: ClientInvoiceRow["status"]): string {
  if (status === "pendente") return "Pendente";
  if (status === "cancelada") return "Cancelada";
  return "Emitida";
}

function statusVariant(
  status: ClientInvoiceRow["status"]
): "success" | "warning" | "default" {
  if (status === "emitida") return "success";
  if (status === "pendente") return "warning";
  return "default";
}

export default async function FinanceiroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctx = user ? await loadUserContext(user.id) : null;
  const isAdmin = ctx?.isAdmin ?? false;

  let invoices: ClientInvoiceRow[] = [];
  let clientFound = false;

  if (user && !isAdmin) {
    const clientId = await resolveClientForUser(user.id);
    if (clientId) {
      clientFound = true;
      invoices = await listClientInvoices(clientId);
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

      {/* Admin notice */}
      {isAdmin && (
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <CreditCard size={14} className="text-vitti-light/40 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-light text-white/60">
                  Você está autenticado como administrador Vitti.
                </p>
                <p className="text-xs text-white/25 font-light mt-0.5">
                  O painel de NFs dos clientes fica na área administrativa.
                </p>
              </div>
              <Link
                href="/admin/financeiro"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-vitti-blue/30 text-[11px] font-light text-vitti-light/70 hover:border-vitti-blue/50 hover:text-vitti-light transition-all"
              >
                <ExternalLink size={11} />
                Admin Financeiro
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client with no linked client */}
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

      {/* Notas Fiscais — real data */}
      {!isAdmin && clientFound && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={13} className="text-vitti-light/30" />
                <CardTitle>Notas Fiscais</CardTitle>
              </div>
              <Badge label={`${invoices.length} NF${invoices.length !== 1 ? "s" : ""}`} variant="info" />
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
                {invoices.map((nf) => (
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
                          {nf.competence}
                          {nf.issuedAt ? ` · ${formatDate(nf.issuedAt)}` : ""}
                        </p>
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
                      {nf.nfUrl ? (
                        <a
                          href={nf.nfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Ver nota fiscal"
                          className="p-1.5 text-white/25 hover:text-vitti-light/60 transition-colors"
                        >
                          <ExternalLink size={13} />
                        </a>
                      ) : (
                        <span className="p-1.5 text-white/10">
                          <ExternalLink size={13} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
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
