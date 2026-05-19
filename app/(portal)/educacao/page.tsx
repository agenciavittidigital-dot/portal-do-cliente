import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { GraduationCap } from "lucide-react";

export default function EducacaoPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide">
          Educação
        </h2>
        <p className="text-sm text-white/25 mt-0.5 font-light">
          Conteúdos e materiais exclusivos para você
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap size={13} className="text-vitti-light/30" />
              <CardTitle>Biblioteca de Conteúdos</CardTitle>
            </div>
            <Badge label="Em breve" variant="info" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-52 flex flex-col items-center justify-center gap-2 border border-dashed border-white/5 rounded-lg">
            <GraduationCap size={32} className="text-white/8" />
            <p className="text-white/15 text-xs font-light">
              Módulo de educação em desenvolvimento
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
