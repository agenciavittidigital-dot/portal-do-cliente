import { MapPin } from "lucide-react";
import type { RegionRow } from "@/lib/data/performance-breakdowns";

// ── Tile grid do Brasil — posições aproximadas por estado ─────────────────────
//
// Cada estado ocupa uma célula em um grid 8 × 8.
// Posições derivadas da geografia real, compactadas em tile cartogram.

interface StateCell {
  row: number;
  col: number;
  abbr: string;
  name: string;
}

const GRID_COLS = 8;
const GRID_ROWS = 8;

const BRAZIL_GRID: StateCell[] = [
  // Norte
  { row: 0, col: 2, abbr: "RR", name: "Roraima" },
  { row: 0, col: 3, abbr: "AP", name: "Amapá" },
  { row: 1, col: 0, abbr: "AM", name: "Amazonas" },
  { row: 1, col: 2, abbr: "PA", name: "Pará" },
  { row: 2, col: 0, abbr: "AC", name: "Acre" },
  { row: 2, col: 1, abbr: "RO", name: "Rondônia" },
  { row: 2, col: 2, abbr: "TO", name: "Tocantins" },
  // Nordeste
  { row: 1, col: 3, abbr: "MA", name: "Maranhão" },
  { row: 1, col: 4, abbr: "PI", name: "Piauí" },
  { row: 1, col: 5, abbr: "CE", name: "Ceará" },
  { row: 1, col: 6, abbr: "RN", name: "R.G. Norte" },
  { row: 2, col: 4, abbr: "PB", name: "Paraíba" },
  { row: 2, col: 5, abbr: "PE", name: "Pernambuco" },
  { row: 2, col: 6, abbr: "AL", name: "Alagoas" },
  { row: 2, col: 7, abbr: "SE", name: "Sergipe" },
  { row: 3, col: 5, abbr: "BA", name: "Bahia" },
  // Centro-Oeste
  { row: 3, col: 1, abbr: "MT", name: "Mato Grosso" },
  { row: 3, col: 2, abbr: "GO", name: "Goiás" },
  { row: 3, col: 3, abbr: "DF", name: "Distrito Federal" },
  { row: 4, col: 2, abbr: "MS", name: "Mato Grosso do Sul" },
  // Sudeste
  { row: 3, col: 4, abbr: "MG", name: "Minas Gerais" },
  { row: 3, col: 6, abbr: "ES", name: "Espírito Santo" },
  { row: 4, col: 4, abbr: "SP", name: "São Paulo" },
  { row: 4, col: 5, abbr: "RJ", name: "Rio de Janeiro" },
  // Sul
  { row: 5, col: 4, abbr: "PR", name: "Paraná" },
  { row: 6, col: 4, abbr: "SC", name: "Santa Catarina" },
  { row: 7, col: 3, abbr: "RS", name: "R.G. do Sul" },
];

// ── Mapa de nomes Windsor → sigla ─────────────────────────────────────────────
//
// Windsor retorna nomes completos, às vezes com sufixo "(state)" ou "(city)".
// A normalização remove acentos e sufixos antes do lookup.

const REGION_TO_ABBR: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM",
  bahia: "BA", ceara: "CE", "distrito federal": "DF",
  "espirito santo": "ES", goias: "GO", maranhao: "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS",
  "minas gerais": "MG", para: "PA", paraiba: "PB",
  parana: "PR", pernambuco: "PE", piaui: "PI",
  "rio de janeiro": "RJ", "rio grande do norte": "RN",
  "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE",
  tocantins: "TO",
};

function toAbbr(regionName: string): string | null {
  const normalized = regionName
    .toLowerCase()
    .replace(/\s*\(state\)\s*$/i, "")
    .replace(/\s*\(city\)\s*$/i, "")
    .replace(/\s*\(district\)\s*$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  return REGION_TO_ABBR[normalized] ?? null;
}

// ── Placeholder ───────────────────────────────────────────────────────────────

function Placeholder() {
  return (
    <div className="rounded-xl border bg-[#f1f1f1] border-[#dfdedf] p-4 flex flex-col">
      <h4 className="text-[11px] font-light text-[#455cab] tracking-wide">Por estado</h4>
      <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-[200px]">
        <MapPin size={16} className="text-[#455cab]/20" />
        <p className="text-[10px] text-[#171f38]/30 font-light text-center leading-relaxed">
          Dados regionais<br />em breve
        </p>
      </div>
    </div>
  );
}

// ── RegionHeatmap ─────────────────────────────────────────────────────────────

interface Props {
  rows: RegionRow[];
  isLeads?: boolean;
}

export function RegionHeatmap({ rows, isLeads = false }: Props) {
  if (rows.length === 0) return <Placeholder />;

  // Escolhe métrica: leads se campanha de leads E há dados de leads; senão spend
  const hasLeadData = rows.some((r) => r.leads > 0);
  const useLeads = isLeads && hasLeadData;

  // Agrega por sigla
  const valueByAbbr = new Map<string, number>();
  for (const row of rows) {
    const abbr = toAbbr(row.region);
    if (!abbr) continue;
    const v = useLeads ? row.leads : row.spend;
    valueByAbbr.set(abbr, (valueByAbbr.get(abbr) ?? 0) + v);
  }
  const maxValue = Math.max(...valueByAbbr.values(), 0);

  // Formatação
  const fmt = useLeads
    ? (v: number) => String(Math.round(v))
    : (v: number) =>
        new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(v);

  return (
    <div className="rounded-xl border bg-[#f1f1f1] border-[#dfdedf] p-4 flex flex-col gap-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-light text-[#455cab] tracking-wide">Por estado</h4>
        <span className="text-[8px] text-[#455cab]/40 font-light uppercase tracking-wider">
          {useLeads ? "leads" : "investimento"}
        </span>
      </div>

      {/* Tile map — max-w limita largura → limita altura via aspect-square */}
      <div className="flex items-center justify-center">
      <div
        className="grid gap-[2px] max-w-[210px] w-full"
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
      >
        {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, idx) => {
          const row = Math.floor(idx / GRID_COLS);
          const col = idx % GRID_COLS;
          const state = BRAZIL_GRID.find((s) => s.row === row && s.col === col);

          if (!state) {
            // Célula vazia — mantém espaçamento, sem visual
            return (
              <div
                key={idx}
                className="aspect-square"
                aria-hidden="true"
              />
            );
          }

          const value = valueByAbbr.get(state.abbr) ?? 0;
          const intensity = value > 0 && maxValue > 0 ? value / maxValue : 0;
          // Sem dado: opacidade mínima; com dado: escala de 0.15 a 0.85
          const alpha = intensity > 0 ? 0.15 + intensity * 0.70 : 0.07;
          const textLight = intensity > 0.52;
          const tooltip =
            value > 0
              ? `${state.name}: ${fmt(value)}`
              : state.name;

          return (
            <div
              key={state.abbr}
              title={tooltip}
              className="aspect-square rounded-[2px] flex items-center justify-center cursor-default transition-opacity duration-150 hover:opacity-70"
              style={{ backgroundColor: `rgba(69,92,171,${alpha})` }}
            >
              <span
                className="text-[7px] font-medium select-none leading-none"
                style={{ color: textLight ? "rgba(255,255,255,0.85)" : "rgba(69,92,171,0.65)" }}
              >
                {state.abbr}
              </span>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
