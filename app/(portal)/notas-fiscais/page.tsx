import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Receipt } from "lucide-react";

export default function NotasFiscaisPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide">
          Notas Fiscais
        </h2>
        <p className="text-sm text-white/25 mt-0.5 font-light">
          Acesse e baixe suas notas fiscais emitidas
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Notas Emitidas</CardTitle>
            <Badge label="Em desenvolvimento" variant="info" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-52 flex flex-col items-center justify-center gap-2 border border-dashed border-white/5 rounded-lg">
            <Receipt size={28} className="text-white/8" />
            <p className="text-white/15 text-xs font-light">
              Módulo de notas fiscais em desenvolvimento
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
