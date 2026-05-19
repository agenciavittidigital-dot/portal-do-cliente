import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BarChart3, TrendingUp, Users, DollarSign } from "lucide-react";

const stats = [
  { label: "Impressões", icon: BarChart3 },
  { label: "Cliques", icon: TrendingUp },
  { label: "Leads", icon: Users },
  { label: "Investimento", icon: DollarSign },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide">
          Olá, bem-vindo
        </h2>
        <p className="text-sm text-white/25 mt-0.5 font-light">
          Visão geral da sua performance
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{stat.label}</CardTitle>
                  <Icon size={14} className="text-vitti-light/20" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-light text-white/80">—</p>
                <Badge label="Aguardando dados" variant="default" className="mt-2" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-52 flex flex-col items-center justify-center gap-2 border border-dashed border-white/5 rounded-lg">
            <BarChart3 size={28} className="text-white/8" />
            <p className="text-white/15 text-xs font-light">
              Gráfico de performance em breve
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Últimos Relatórios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-28 flex items-center justify-center border border-dashed border-white/5 rounded-lg">
              <p className="text-white/15 text-xs font-light">Em breve</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Próximas Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-28 flex items-center justify-center border border-dashed border-white/5 rounded-lg">
              <p className="text-white/15 text-xs font-light">Em breve</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
