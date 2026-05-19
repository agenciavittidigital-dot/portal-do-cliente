import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BarChart3 } from "lucide-react";

const channels = ["Meta Ads", "Google Ads", "SEO", "Social Media"];

export default function MetricasPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide">
          Dados e Métricas
        </h2>
        <p className="text-sm text-white/25 mt-0.5 font-light">
          Acompanhe sua performance em tempo real
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map((channel) => (
          <Card key={channel}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{channel}</CardTitle>
                <Badge label="Em breve" variant="info" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-36 flex flex-col items-center justify-center gap-2 border border-dashed border-white/5 rounded-lg">
                <BarChart3 size={22} className="text-white/8" />
                <p className="text-white/15 text-xs font-light">
                  Dados de {channel}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
