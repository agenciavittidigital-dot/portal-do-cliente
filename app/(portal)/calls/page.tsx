import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Video, Calendar } from "lucide-react";

const upcoming = [
  { title: "Reunião de Performance" },
  { title: "Alinhamento Mensal" },
];

export default function CallsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide">
          Calls
        </h2>
        <p className="text-sm text-white/25 mt-0.5 font-light">
          Reuniões e gravações com a equipe Vitti
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-vitti-light/30" />
              <CardTitle>Próximas Reuniões</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcoming.map((call) => (
                <div
                  key={call.title}
                  className="flex items-center justify-between p-3 rounded-lg border border-white/5"
                >
                  <div className="flex items-center gap-2.5">
                    <Video size={14} className="text-vitti-light/30 shrink-0" />
                    <span className="text-sm font-light text-white/60">
                      {call.title}
                    </span>
                  </div>
                  <Badge label="Em breve" variant="default" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gravações Anteriores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex flex-col items-center justify-center gap-2 border border-dashed border-white/5 rounded-lg">
              <Video size={22} className="text-white/8" />
              <p className="text-white/15 text-xs font-light">
                Gravações em desenvolvimento
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
