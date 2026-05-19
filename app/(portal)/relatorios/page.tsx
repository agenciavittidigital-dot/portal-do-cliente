import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FileText, Download } from "lucide-react";

const reports = [
  { name: "Relatório Mensal — Abril 2025", period: "Abr 2025" },
  { name: "Relatório Mensal — Março 2025", period: "Mar 2025" },
  { name: "Relatório Mensal — Fevereiro 2025", period: "Fev 2025" },
];

export default function RelatoriosPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide">
          Relatórios
        </h2>
        <p className="text-sm text-white/25 mt-0.5 font-light">
          Seus relatórios mensais e personalizados
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Relatórios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {reports.map((report) => (
              <div
                key={report.name}
                className="flex items-center justify-between p-3.5 rounded-lg border border-white/5 hover:border-white/8 hover:bg-white/[0.02] transition-all cursor-default"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText
                    size={15}
                    className="text-vitti-light/30 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-light text-white/70 truncate">
                      {report.name}
                    </p>
                    <p className="text-[11px] text-white/25 font-light mt-0.5">
                      {report.period}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Badge label="Disponível" variant="success" />
                  <button
                    aria-label="Baixar relatório"
                    className="p-1.5 text-white/20 hover:text-vitti-light/70 transition-colors"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-white/15 text-[11px] mt-5 font-light">
            Dados de exemplo — integração em desenvolvimento
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
