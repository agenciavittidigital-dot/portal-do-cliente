import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { loadActiveClients } from "@/lib/data/dashboards";
import { computeDateRange, loadPerformanceData } from "@/lib/data/performance";
import { listClientInvoices } from "@/lib/data/invoices-client";
import { listPublishedReports } from "@/lib/data/reports-client";
import { listPublishedCalls } from "@/lib/data/calls-client";
import {
  Target,
  Search,
  FileText,
  CreditCard,
  Phone,
  BarChart3,
  ArrowRight,
  Users,
} from "lucide-react";
import type { PerformanceSummary } from "@/types";
import type { ClientInvoiceRow } from "@/lib/data/invoices-client";
import type { ClientReportRow } from "@/lib/data/reports-client";
import type { ClientCallRow } from "@/lib/data/calls-client";

// ── Formatadores ───────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtNumber(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const parts = iso.slice(0, 10).split("-");
  if (parts.length < 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function fmtMonth(iso: string | null): string {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length < 2) return iso;
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const m = parseInt(parts[1]) - 1;
  return `${months[m] ?? parts[1]}. ${parts[0]}`;
}

// ── PlatformCard ───────────────────────────────────────────────────────────────

function PlatformCard({
  label,
  icon,
  summary,
}: {
  label: string;
  icon: ReactNode;
  summary: PerformanceSummary | null;
}) {
  const spend = typeof summary?.spend === "number" ? summary.spend : null;
  const impressions = typeof summary?.impressions === "number" ? summary.impressions : null;
  const clicks = typeof summary?.clicks === "number" ? summary.clicks : null;
  const conversions = typeof summary?.leads === "number" ? summary.leads : null;

  const rows: { label: string; value: string | null }[] = [
    { label: "Investimento", value: spend !== null ? fmtCurrency(spend) : null },
    { label: "Impressões", value: impressions !== null ? fmtNumber(impressions) : null },
    { label: "Cliques", value: clicks !== null ? fmtNumber(clicks) : null },
    { label: "Conversões", value: conversions !== null ? fmtNumber(conversions) : null },
  ];

  return (
    <div className="rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-vitti-gray/[0.10] border border-vitti-gray/[0.14] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <span className="text-xs font-light text-vitti-blue/60">{label}</span>
      </div>
      {summary === null ? (
        <p className="text-xs font-light text-vitti-blue/40 italic">Sem dados no período</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-light text-vitti-blue/50 shrink-0">{row.label}</span>
              {row.value !== null ? (
                <span className="text-sm font-light text-vitti-blue tabular-nums">{row.value}</span>
              ) : (
                <span className="text-xs font-light text-vitti-blue/35 italic">—</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── RecentCard ─────────────────────────────────────────────────────────────────

function RecentCard({
  label,
  icon,
  title,
  subtitle,
  extra,
  href,
}: {
  label: string;
  icon: ReactNode;
  title: string | null;
  subtitle: string | null;
  extra?: string | null;
  href: string;
}) {
  return (
    <Link href={href} className="group block h-full">
      <div className="rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-5 hover:border-vitti-gray/[0.25] hover:shadow-md transition-all h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-vitti-gray/[0.10] border border-vitti-gray/[0.14] flex items-center justify-center shrink-0">
              {icon}
            </div>
            <span className="text-[10px] font-light text-vitti-blue/45 uppercase tracking-widest">
              {label}
            </span>
          </div>
          <ArrowRight
            size={11}
            className="text-vitti-blue/25 group-hover:text-vitti-blue/60 transition-colors shrink-0"
          />
        </div>
        {title ? (
          <div className="space-y-1.5">
            <p className="text-sm font-light text-vitti-blue line-clamp-2 leading-snug">
              {title}
            </p>
            {subtitle && (
              <p className="text-[10px] font-light text-vitti-blue/50">{subtitle}</p>
            )}
            {extra && (
              <p className="text-xs font-light text-vitti-blue/70 tabular-nums">{extra}</p>
            )}
          </div>
        ) : (
          <p className="text-xs font-light text-vitti-blue/40 italic">Nenhum registrado</p>
        )}
      </div>
    </Link>
  );
}

// ── QuickLink ──────────────────────────────────────────────────────────────────

function QuickLink({
  label,
  href,
  icon,
}: {
  label: string;
  href: string;
  icon: ReactNode;
}) {
  return (
    <Link href={href} className="group">
      <div className="flex items-center justify-between px-4 py-3.5 rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:border-vitti-blue/25 hover:bg-vitti-blue/[0.06] transition-all">
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="text-xs font-light text-vitti-blue/70 group-hover:text-vitti-blue transition-colors">
            {label}
          </span>
        </div>
        <ArrowRight
          size={11}
          className="text-vitti-blue/25 group-hover:text-vitti-blue/60 transition-colors"
        />
      </div>
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
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

  // ── Resolve target client ──────────────────────────────────────────────────
  let targetClientId: string | null = null;
  let targetClientName: string | null = null;

  if (isAdmin) {
    if (urlClientId) {
      const { clients } = await loadActiveClients();
      const found = clients.find((c) => c.id === urlClientId);
      if (found) {
        targetClientId = found.id;
        targetClientName = found.name;
      }
    }
  } else {
    targetClientId = ctx?.client?.id ?? null;
    targetClientName = ctx?.client?.name ?? null;
  }

  // ── Admin sem cliente: orientação ──────────────────────────────────────────
  if (isAdmin && !targetClientId) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div>
          <h2 className="text-xl font-light text-vitti-blue tracking-wide">Admin Vitti</h2>
          <p className="text-sm text-vitti-blue/50 mt-0.5 font-light">Painel administrativo</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-dashed border-vitti-gray/[0.20]">
          <div className="w-12 h-12 rounded-full bg-vitti-gray/[0.08] border border-vitti-gray/[0.14] flex items-center justify-center">
            <Users size={18} className="text-vitti-blue/25" />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm font-light text-vitti-blue/60">Nenhum cliente selecionado</p>
            <p className="text-xs text-vitti-blue/40 font-light max-w-xs leading-relaxed">
              Acesse Métricas e selecione um cliente para visualizar a visão geral.
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <Link
              href="/metricas"
              className="flex items-center gap-2 text-xs font-light px-4 py-2 rounded-full border border-vitti-gray/[0.20] text-vitti-blue/60 hover:text-vitti-blue hover:border-vitti-blue/30 transition-all"
            >
              <BarChart3 size={12} />
              Ir para Métricas
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-2 text-xs font-light px-4 py-2 rounded-full border border-vitti-gray/[0.20] text-vitti-blue/60 hover:text-vitti-blue hover:border-vitti-blue/30 transition-all"
            >
              <ArrowRight size={12} />
              Ir para Admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Carregar dados em paralelo ─────────────────────────────────────────────
  const { start: perfStart, end: perfEnd } = computeDateRange("last_30_days");

  let metaAdsData = null as Awaited<ReturnType<typeof loadPerformanceData>>;
  let googleAdsData = null as Awaited<ReturnType<typeof loadPerformanceData>>;
  let invoiceList: ClientInvoiceRow[] = [];
  let reportList: ClientReportRow[] = [];
  let callList: ClientCallRow[] = [];

  if (targetClientId) {
    [metaAdsData, googleAdsData, invoiceList, reportList, callList] = await Promise.all([
      loadPerformanceData(targetClientId, "meta_ads", perfStart, perfEnd),
      loadPerformanceData(targetClientId, "google_ads", perfStart, perfEnd),
      listClientInvoices(targetClientId),
      listPublishedReports(targetClientId),
      listPublishedCalls(targetClientId),
    ]);
  }

  const metaAds = metaAdsData?.summary ?? null;
  const googleAds = googleAdsData?.summary ?? null;
  const latestInvoice = invoiceList[0] ?? null;
  const latestReport = reportList[0] ?? null;
  const latestCall = callList[0] ?? null;

  const qp =
    isAdmin && targetClientId
      ? `?clientId=${encodeURIComponent(targetClientId)}`
      : "";

  const greeting = targetClientName ?? (isAdmin ? "Admin" : "Bem-vindo");
  const userName = ctx?.profile?.name ? `, ${ctx.profile.name.split(" ")[0]}` : "";

  // ── Sem cliente vinculado (cliente comum) ──────────────────────────────────
  if (!targetClientId) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div>
          <h2 className="text-xl font-light text-vitti-blue tracking-wide">
            Olá{userName}
          </h2>
          <p className="text-sm text-vitti-blue/50 mt-0.5 font-light">Visão geral</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border border-dashed border-vitti-gray/[0.20]">
          <p className="text-sm font-light text-vitti-blue/50">
            Nenhum cliente vinculado à sua conta.
          </p>
          <p className="text-xs text-vitti-blue/35 font-light">
            Contate a equipe Vitti para vinculação.
          </p>
        </div>
      </div>
    );
  }

  // ── Visão geral completa ───────────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-light text-vitti-blue tracking-wide">
          Olá, {greeting}
        </h2>
        <p className="text-sm text-vitti-blue/50 mt-0.5 font-light">
          Visão geral · últimos 30 dias
        </p>
      </div>

      {/* Performance por plataforma */}
      <section>
        <p className="text-[9px] text-vitti-blue/40 tracking-[0.2em] uppercase font-light mb-3">
          Performance
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlatformCard
            label="Meta Ads"
            icon={<Target size={12} className="text-vitti-light/60" />}
            summary={metaAds}
          />
          <PlatformCard
            label="Google Ads"
            icon={<Search size={12} className="text-vitti-light/60" />}
            summary={googleAds}
          />
        </div>
      </section>

      {/* Itens recentes */}
      <section>
        <p className="text-[9px] text-vitti-blue/40 tracking-[0.2em] uppercase font-light mb-3">
          Recentes
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RecentCard
            label="Última NF"
            icon={<CreditCard size={11} className="text-vitti-light/50" />}
            title={latestInvoice?.title ?? null}
            subtitle={latestInvoice ? fmtMonth(latestInvoice.referenceMonth) : null}
            extra={
              latestInvoice?.amount != null
                ? fmtCurrency(latestInvoice.amount)
                : null
            }
            href={`/financeiro${qp}`}
          />
          <RecentCard
            label="Último Relatório"
            icon={<FileText size={11} className="text-vitti-light/50" />}
            title={latestReport?.title ?? null}
            subtitle={latestReport?.period ?? null}
            href={`/relatorios${qp}`}
          />
          <RecentCard
            label="Última Call"
            icon={<Phone size={11} className="text-vitti-light/50" />}
            title={latestCall?.title ?? null}
            subtitle={latestCall ? fmtDate(latestCall.callDate) : null}
            href={`/calls${qp}`}
          />
        </div>
      </section>

      {/* Atalhos rápidos */}
      <section>
        <p className="text-[9px] text-vitti-blue/40 tracking-[0.2em] uppercase font-light mb-3">
          Acessar
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink
            label="Métricas"
            href={`/metricas${qp}`}
            icon={<BarChart3 size={14} className="text-vitti-light/60" />}
          />
          <QuickLink
            label="Financeiro"
            href={`/financeiro${qp}`}
            icon={<CreditCard size={14} className="text-vitti-light/60" />}
          />
          <QuickLink
            label="Relatórios"
            href={`/relatorios${qp}`}
            icon={<FileText size={14} className="text-vitti-light/60" />}
          />
          <QuickLink
            label="Calls"
            href={`/calls${qp}`}
            icon={<Phone size={14} className="text-vitti-light/60" />}
          />
        </div>
      </section>
    </div>
  );
}
