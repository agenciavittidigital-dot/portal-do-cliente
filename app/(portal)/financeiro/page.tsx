import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  CreditCard,
  FileText,
  Download,
  Copy,
  Barcode,
  AlertCircle,
} from "lucide-react";

const invoices = [
  { ref: "NF-e 000.001", period: "Abr 2025", amount: "—" },
  { ref: "NF-e 000.002", period: "Mar 2025", amount: "—" },
  { ref: "NF-e 000.003", period: "Fev 2025", amount: "—" },
];

export default function FinanceiroPage() {
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

      {/* Summary — 2 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Próximo Vencimento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-light text-white/70">—</p>
            <Badge label="Aguardando dados" variant="default" className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Status Atual</CardTitle>
              <AlertCircle size={13} className="text-white/15" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-light text-white/70">—</p>
            <Badge label="Aguardando dados" variant="info" className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Pagamentos & Boletos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Barcode size={13} className="text-vitti-light/30" />
              <CardTitle>Pagamentos & Boletos</CardTitle>
            </div>
            <Badge label="Em desenvolvimento" variant="info" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Boleto placeholder row */}
          <div className="rounded-lg border border-white/8 p-4 space-y-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <CreditCard size={13} className="text-vitti-light/30 shrink-0" />
                  <span className="text-[10px] font-light text-white/35 uppercase tracking-[0.15em]">
                    Referência — Maio/2025
                  </span>
                </div>
                <div className="flex items-end gap-6">
                  <div>
                    <p className="text-[10px] text-white/20 font-light uppercase tracking-wider mb-0.5">
                      Valor
                    </p>
                    <p className="text-xl font-light text-white/40">—</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/20 font-light uppercase tracking-wider mb-0.5">
                      Vencimento
                    </p>
                    <p className="text-sm font-light text-white/40">—</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2.5 shrink-0">
                <Badge label="Aguardando" variant="default" />
                <div className="flex gap-2">
                  <button
                    disabled
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-light text-white/20 border border-white/5 opacity-50 cursor-not-allowed"
                  >
                    <Copy size={11} />
                    Copiar código
                  </button>
                  <button
                    disabled
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-light text-white/20 border border-white/5 opacity-50 cursor-not-allowed"
                  >
                    <Download size={11} />
                    PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Barcode decorative */}
            <div
              className="h-7 rounded opacity-[0.05]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, white 0px, white 2px, transparent 2px, transparent 5px, white 5px, white 6px, transparent 6px, transparent 10px, white 10px, white 13px, transparent 13px, transparent 16px)",
              }}
            />
          </div>

          <p className="text-center text-[11px] text-white/15 font-light pt-1">
            Integração de cobranças em desenvolvimento
          </p>
        </CardContent>
      </Card>

      {/* Notas Fiscais */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={13} className="text-vitti-light/30" />
              <CardTitle>Notas Fiscais</CardTitle>
            </div>
            <Badge label="Em desenvolvimento" variant="info" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {invoices.map((nf) => (
              <div
                key={nf.ref}
                className="flex items-center justify-between p-3.5 rounded-lg border border-white/5 hover:border-white/8 hover:bg-white/[0.02] transition-all cursor-default"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={14} className="text-vitti-light/25 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-light text-white/60 truncate">
                      {nf.ref}
                    </p>
                    <p className="text-[11px] text-white/25 font-light mt-0.5">
                      {nf.period}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-sm font-light text-white/30">{nf.amount}</span>
                  <Badge label="Aguardando" variant="default" />
                  <button
                    aria-label="Baixar nota fiscal"
                    className="p-1.5 text-white/15 hover:text-vitti-light/50 transition-colors cursor-not-allowed"
                    disabled
                  >
                    <Download size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-white/15 mt-4 font-light">
            Dados de exemplo — integração em desenvolvimento
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
