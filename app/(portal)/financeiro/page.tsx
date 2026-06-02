import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import {
  resolveClientForUser,
  listClientInvoices,
  listClientPayments,
} from "@/lib/data/invoices-client";
import type { ClientInvoiceRow, ClientPaymentRow } from "@/lib/data/invoices-client";
import { getSignedDownloadUrl } from "@/lib/storage/portal-files";
import { NfHistorySection } from "@/components/financeiro/NfHistorySection";
import { PaymentHistorySection } from "@/components/financeiro/PaymentHistorySection";
import {
  ArrowLeft,
  Barcode,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
} from "lucide-react";
import Link from "next/link";

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtCurrency(v: number | null, currency = "BRL"): string {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function fmtRefMonth(dateStr: string | null): string {
  if (!dateStr) return "";
  const MONTHS = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
  ];
  const parts = dateStr.split("-");
  if (parts.length >= 2) {
    const month = MONTHS[parseInt(parts[1], 10) - 1] ?? parts[1];
    return `${month} ${parts[0]}`;
  }
  return dateStr;
}

function fmtFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId: urlClientId } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ctx     = user ? await loadUserContext(user.id) : null;
  const isAdmin = ctx?.isAdmin ?? false;

  let invoices: ClientInvoiceRow[] = [];
  let payments: ClientPaymentRow[] = [];
  const invoiceUrls: Record<string, string | null> = {};
  const paymentUrls: Record<string, string | null> = {}; // boleto (pending) ou receipt (paid)
  let clientFound  = false;
  let adminPreview = false;

  if (user) {
    if (isAdmin) {
      if (urlClientId) {
        adminPreview = true;
        clientFound  = true;
        ;[invoices, payments] = await Promise.all([
          listClientInvoices(urlClientId),
          listClientPayments(urlClientId),
        ]);
      }
    } else {
      const clientId = await resolveClientForUser(user.id);
      if (clientId) {
        clientFound = true;
        ;[invoices, payments] = await Promise.all([
          listClientInvoices(clientId),
          listClientPayments(clientId),
        ]);
      }
    }
  }

  // URLs de download das NFs
  await Promise.all(
    invoices.map(async (inv) => {
      try { invoiceUrls[inv.id] = await getSignedDownloadUrl(inv.filePath, 3600); }
      catch { invoiceUrls[inv.id] = null; }
    })
  );

  // URLs de download dos boletos (pending: boleto file) e recibos (paid: receipt file)
  await Promise.all(
    payments.map(async (p) => {
      const isPending = p.status === "pending" || p.status === "overdue";
      const filePath  = isPending ? p.boletoFilePath : p.receiptFilePath;
      if (filePath) {
        try { paymentUrls[p.id] = await getSignedDownloadUrl(filePath, 3600); }
        catch { paymentUrls[p.id] = null; }
      } else {
        paymentUrls[p.id] = null;
      }
    })
  );

  // Separar pendentes e histórico
  const today          = new Date().toISOString().slice(0, 10);
  const pendingPayments = payments.filter(
    (p) => p.status === "pending" || p.status === "overdue"
  );
  const paidPayments    = payments.filter(
    (p) => p.status === "paid" || p.status === "cancelled" || p.status === "failed"
  );

  const latestNf    = invoices[0] ?? null;
  const latestNfUrl = latestNf ? (invoiceUrls[latestNf.id] ?? null) : null;

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Cabeçalho */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-vitti-fg">Financeiro</h2>
        <p className="text-sm text-vitti-fg-muted mt-0.5">
          Central financeira do seu contrato
        </p>
      </div>

      {/* Admin: sem clientId */}
      {isAdmin && !adminPreview && (
        <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-4 flex items-center gap-3">
          <CreditCard size={14} className="text-[#455cab]/50 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-light text-[#171f38]">
              Você está autenticado como administrador Vitti.
            </p>
            <p className="text-xs text-[#171f38]/50 font-light mt-0.5">
              Selecione um cliente em Admin → Financeiro e clique em &ldquo;Ver como cliente&rdquo;.
            </p>
          </div>
          <Link
            href="/admin/financeiro"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#455cab]/30 text-[11px] font-light text-[#455cab]/70 hover:border-[#455cab]/60 hover:text-[#455cab] transition-all shrink-0"
          >
            <ExternalLink size={11} />
            Admin Financeiro
          </Link>
        </div>
      )}

      {/* Admin: modo preview */}
      {isAdmin && adminPreview && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[#455cab]/20 bg-[#455cab]/[0.04]">
          <span className="text-[10px] font-light text-[#455cab]/60">
            Visualização do cliente — modo admin
          </span>
          <Link
            href="/admin/financeiro"
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-light text-[#455cab]/60 hover:text-[#455cab] transition-colors"
          >
            <ArrowLeft size={9} />
            Voltar ao Admin
          </Link>
        </div>
      )}

      {/* Cliente sem vínculo */}
      {!isAdmin && !clientFound && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 flex flex-col items-center justify-center gap-3">
          <CreditCard size={20} className="text-[#455cab]/20" />
          <p className="text-sm font-light text-[#171f38]/50">
            Nenhum cliente vinculado à sua conta.
          </p>
          <p className="text-xs text-[#171f38]/35 font-light">
            Entre em contato com a Vitti Digital.
          </p>
        </div>
      )}

      {/* ── Conteúdo principal ──────────────────────────────────────────────── */}
      {clientFound && (
        <>
          {/* ── Notas Fiscais ───────────────────────────────────────── */}
          <div>
            <p className="text-[9px] text-[#455cab]/50 font-light tracking-[0.15em] uppercase mb-3">
              Notas Fiscais
            </p>

            {latestNf ? (
              <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-5 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-[#455cab]/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-light text-[#171f38] leading-snug">
                    {latestNf.title}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {latestNf.referenceMonth && (
                      <span className="text-[11px] text-[#171f38]/55 font-light">
                        {fmtRefMonth(latestNf.referenceMonth)}
                      </span>
                    )}
                    {latestNf.invoiceNumber && (
                      <span className="text-[11px] text-[#171f38]/40 font-light">
                        · NF {latestNf.invoiceNumber}
                      </span>
                    )}
                  </div>
                  {latestNf.description && (
                    <p className="text-[11px] text-[#171f38]/45 font-light mt-1.5 leading-relaxed line-clamp-2">
                      {latestNf.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {latestNf.amount != null && (
                      <span className="text-sm font-light text-[#455cab] tabular-nums">
                        {fmtCurrency(latestNf.amount)}
                      </span>
                    )}
                    {(latestNf.issuedAt ?? latestNf.createdAt) && (
                      <span className="text-[10px] text-[#171f38]/35 font-light">
                        Emitida em {fmtDate(latestNf.issuedAt ?? latestNf.createdAt)}
                      </span>
                    )}
                    {latestNf.fileName && latestNf.fileSize && (
                      <span className="text-[10px] text-[#171f38]/30 font-light truncate max-w-[200px]">
                        {latestNf.fileName} · {fmtFileSize(latestNf.fileSize)}
                      </span>
                    )}
                  </div>
                </div>
                {latestNfUrl && (
                  <a
                    href={latestNfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#455cab] text-white text-[11px] font-light hover:bg-[#3f4d87] transition-colors shrink-0"
                  >
                    <Download size={12} />
                    Baixar NF
                  </a>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 py-12 flex flex-col items-center justify-center gap-2">
                <FileText size={18} className="text-[#455cab]/20" />
                <p className="text-sm font-light text-[#171f38]/40">
                  Nenhuma nota fiscal disponível no momento
                </p>
              </div>
            )}

            <NfHistorySection invoices={invoices} downloadUrls={invoiceUrls} />
          </div>

          {/* Divisor */}
          <div className="border-t border-slate-200/60" />

          {/* ── Pagamentos e Boletos ─────────────────────────────────── */}
          <div className="space-y-5">
            <p className="text-[9px] text-[#455cab]/50 font-light tracking-[0.15em] uppercase">
              Pagamentos e Boletos
            </p>

            {/* A pagar */}
            <div>
              <p className="text-[9px] text-[#171f38]/40 font-light tracking-[0.12em] uppercase mb-3">
                A pagar
              </p>

              {pendingPayments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-10 flex flex-col items-center justify-center gap-2">
                  <Barcode size={18} className="text-[#455cab]/20" />
                  <p className="text-sm font-light text-[#171f38]/40">
                    Nenhum boleto a pagar
                  </p>
                  <p className="text-[11px] text-[#171f38]/25 font-light">
                    Novos boletos aparecerão aqui quando disponibilizados
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingPayments.map((p) => {
                    const isOverdue = p.dueDate < today;
                    const boletoUrl = paymentUrls[p.id] ?? p.boletoUrl ?? null;
                    return (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-5 flex items-start gap-4"
                      >
                        {/* Ícone */}
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
                          <Barcode size={18} className="text-[#455cab]/70" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-light text-[#171f38] leading-snug">
                              {p.title}
                            </p>
                            {isOverdue && (
                              <span className="text-[9px] font-light px-1.5 py-0.5 rounded bg-red-50 text-red-500/70">
                                Vencido
                              </span>
                            )}
                          </div>
                          {p.description && (
                            <p className="text-[11px] text-[#171f38]/45 font-light mt-0.5 line-clamp-1">
                              {p.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-sm font-light text-[#455cab] tabular-nums">
                              {fmtCurrency(p.amount, p.currency)}
                            </span>
                            <span className={`text-[10px] font-light ${isOverdue ? "text-red-500/60" : "text-[#171f38]/35"}`}>
                              Venc. {fmtDate(p.dueDate)}
                            </span>
                            {p.referenceMonth && (
                              <span className="text-[10px] text-[#171f38]/30 font-light">
                                · {fmtRefMonth(p.referenceMonth)}
                              </span>
                            )}
                          </div>

                          {/* Linha digitável */}
                          {p.digitableLine && (
                            <div className="mt-3 p-2.5 rounded-lg bg-[#455cab]/[0.05] border border-[#455cab]/[0.10]">
                              <p className="text-[8px] text-[#455cab]/50 font-light uppercase tracking-wider mb-1">
                                Linha digitável
                              </p>
                              <p className="text-[11px] font-mono text-[#171f38]/65 break-all leading-relaxed select-all">
                                {p.digitableLine}
                              </p>
                            </div>
                          )}

                          {/* PIX */}
                          {p.pixCode && (
                            <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                              <p className="text-[8px] text-emerald-600/60 font-light uppercase tracking-wider mb-1">
                                Pix Copia e Cola
                              </p>
                              <p className="text-[10px] font-mono text-emerald-700/70 break-all leading-relaxed select-all">
                                {p.pixCode.slice(0, 80)}{p.pixCode.length > 80 ? "..." : ""}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Botão de download */}
                        {boletoUrl ? (
                          <a
                            href={boletoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#455cab] text-white text-[11px] font-light hover:bg-[#3f4d87] transition-colors shrink-0"
                          >
                            <Download size={12} />
                            Boleto
                          </a>
                        ) : p.boletoUrl ? (
                          <a
                            href={p.boletoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#455cab]/40 text-[#455cab] text-[11px] font-light hover:bg-[#455cab]/[0.08] transition-colors shrink-0"
                          >
                            <ExternalLink size={12} />
                            Ver boleto
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Histórico de Pagamentos */}
            <PaymentHistorySection
              payments={paidPayments}
              downloadUrls={paymentUrls}
            />
          </div>
        </>
      )}
    </div>
  );
}
