"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin } from "lucide-react";
import type { RegionRow } from "@/lib/data/performance-breakdowns";

// ── Normalização Windsor → sigla ──────────────────────────────────────────────
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

// ── Coordenadas geográficas de cada estado ────────────────────────────────────
//
// x e y são % dentro do conteúdo real do mapa (não do container).
// Derivadas da posição geográfica de cada estado dentro do bounding box
// do Brasil: lon [-73.9°, -34.8°] × lat [5.3°N, -33.8°S]
//
//   x = (lon + 73.9) / 39.1 × 100
//   y = (5.3 − lat) / 39.1 × 100
//
// O componente converte esses % para coordenadas do container em tempo real
// via cálculo do offset do object-contain (veja toContainerPct).
const STATE_COORDS = [
  // Norte
  { abbr: "RR", name: "Roraima",            x: 29,  y:  8 },
  { abbr: "AP", name: "Amapá",              x: 58,  y:  7 },
  { abbr: "AM", name: "Amazonas",           x: 22,  y: 26 },
  { abbr: "PA", name: "Pará",               x: 55,  y: 24 },
  { abbr: "AC", name: "Acre",               x:  8,  y: 37 },
  { abbr: "RO", name: "Rondônia",           x: 28,  y: 42 },
  { abbr: "TO", name: "Tocantins",          x: 65,  y: 40 },
  // Nordeste
  { abbr: "MA", name: "Maranhão",           x: 73,  y: 26 },
  { abbr: "PI", name: "Piauí",              x: 78,  y: 31 },
  { abbr: "CE", name: "Ceará",              x: 86,  y: 27 },
  { abbr: "RN", name: "R.G. Norte",         x: 91,  y: 29 },
  { abbr: "PB", name: "Paraíba",            x: 90,  y: 32 },
  { abbr: "PE", name: "Pernambuco",         x: 87,  y: 36 },
  { abbr: "AL", name: "Alagoas",            x: 91,  y: 39 },
  { abbr: "SE", name: "Sergipe",            x: 89,  y: 42 },
  { abbr: "BA", name: "Bahia",              x: 80,  y: 46 },
  // Centro-Oeste
  { abbr: "MT", name: "Mato Grosso",        x: 42,  y: 47 },
  { abbr: "GO", name: "Goiás",              x: 63,  y: 55 },
  { abbr: "DF", name: "Distrito Federal",   x: 66,  y: 54 },
  { abbr: "MS", name: "Mato Grosso do Sul", x: 47,  y: 67 },
  // Sudeste
  { abbr: "MG", name: "Minas Gerais",       x: 74,  y: 61 },
  { abbr: "ES", name: "Espírito Santo",     x: 84,  y: 63 },
  { abbr: "RJ", name: "Rio de Janeiro",     x: 78,  y: 71 },
  { abbr: "SP", name: "São Paulo",          x: 63,  y: 70 },
  // Sul
  { abbr: "PR", name: "Paraná",             x: 57,  y: 78 },
  { abbr: "SC", name: "Santa Catarina",     x: 59,  y: 84 },
  { abbr: "RS", name: "Rio Grande do Sul",  x: 53,  y: 91 },
] as const;

// ── Formatadores ──────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);

const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v));

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface StateData {
  spend: number;
  impressions: number;
  leads: number;
  messages_started: number;
}

// Área real da imagem dentro do container (em %) após cálculo do letterboxing.
// Enquanto a imagem não carrega, usa o container inteiro como fallback.
interface ImgArea {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  rows: RegionRow[];
  isLeads?: boolean;
}

interface ActiveBubble {
  abbr: string;
  cx: number; // left % relativo ao container
  cy: number; // top % relativo ao container
  data: StateData;
}

// ── RegionHeatmap ─────────────────────────────────────────────────────────────

export function RegionHeatmap({ rows }: Props) {
  const [active, setActive]   = useState<ActiveBubble | null>(null);
  // Área real exibida pelo object-contain dentro do container
  const [imgArea, setImgArea] = useState<ImgArea>({ left: 0, top: 0, width: 100, height: 100 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);

  // Calcula onde a imagem realmente aparece dentro do container
  // levando em conta object-contain (letterbox / pillarbox).
  useEffect(() => {
    const calculate = () => {
      const img = imgRef.current;
      const box = containerRef.current;
      if (!img || !box || !img.naturalWidth || !img.naturalHeight) return;

      const cW = box.clientWidth;
      const cH = box.clientHeight;
      if (!cW || !cH) return;

      const iRatio = img.naturalWidth / img.naturalHeight;
      const cRatio = cW / cH;

      let dispW: number, dispH: number, offL: number, offT: number;
      if (iRatio > cRatio) {
        // imagem mais larga: barra em cima/baixo
        dispW = cW;
        dispH = cW / iRatio;
        offL  = 0;
        offT  = (cH - dispH) / 2;
      } else {
        // imagem mais alta: barra nas laterais
        dispH = cH;
        dispW = cH * iRatio;
        offL  = (cW - dispW) / 2;
        offT  = 0;
      }

      setImgArea({
        left:   (offL  / cW) * 100,
        top:    (offT  / cH) * 100,
        width:  (dispW / cW) * 100,
        height: (dispH / cH) * 100,
      });
    };

    const img = imgRef.current;
    // Se a imagem já carregou (ex.: cache), calcula imediatamente
    if (img?.complete && img.naturalWidth) {
      calculate();
    } else {
      img?.addEventListener("load", calculate);
    }
    window.addEventListener("resize", calculate);

    return () => {
      img?.removeEventListener("load", calculate);
      window.removeEventListener("resize", calculate);
    };
  }, []);

  // Deslocamento global de todos os pontos (ajuste visual, não recalibra coords)
  const BUBBLE_DX = 3; // % para a direita
  const BUBBLE_DY = 4; // % para baixo

  // Converte coordenada de estado (% do mapa) → % do container
  const toContainerPct = (x: number, y: number) => ({
    cx: imgArea.left + (x * imgArea.width)  / 100 + BUBBLE_DX,
    cy: imgArea.top  + (y * imgArea.height) / 100 + BUBBLE_DY,
  });

  // ── Agrega métricas por sigla ──────────────────────────────────────────────
  const dataByAbbr = new Map<string, StateData>();
  for (const row of rows) {
    const abbr = toAbbr(row.region);
    if (!abbr) continue;
    const prev = dataByAbbr.get(abbr) ?? {
      spend: 0, impressions: 0, leads: 0, messages_started: 0,
    };
    dataByAbbr.set(abbr, {
      spend:            prev.spend            + row.spend,
      impressions:      prev.impressions      + row.impressions,
      leads:            prev.leads            + row.leads,
      messages_started: prev.messages_started + row.messages_started,
    });
  }

  const maxSpend = Math.max(...Array.from(dataByAbbr.values()).map((d) => d.spend), 0);
  const isEmpty  = maxSpend === 0;

  return (
    <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-4 flex flex-col gap-3">
      {/* Cabeçalho */}
      <div>
        <h4 className="text-[11px] font-light text-[#455cab] tracking-wide">Por estado</h4>
      </div>

      {/*
        Container externo — altura fixa, overflow-hidden clipando tudo.
        containerRef mede clientWidth/clientHeight para o cálculo do imgArea.
      */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden bg-[#edf1f8]"
        style={{ height: "220px" }}
      >
        {/*
          Camada exclusiva da imagem.
          overflow-hidden aqui clipa o PNG escalado sem afetar bolhas/tooltip
          que vivem no container pai (fora desta div).
          scale(1.25) aumenta somente o PNG — bolhas não são filhas daqui.
        */}
        <div className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src="/assets/brazil-map.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
            style={{
              opacity:         isEmpty ? 0.35 : 0.92,
              transform:       "scale(1.9)",
              transformOrigin: "center center",
              filter:          "sepia(1) hue-rotate(174deg) saturate(1.6) brightness(0.88)",
            }}
          />
        </div>

        {/* Estado vazio */}
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 z-10">
            <MapPin size={14} className="text-[#455cab]/30" />
            <p className="text-[9px] text-[#455cab]/40 font-light tracking-wide">
              sem dados regionais
            </p>
          </div>
        )}

        {/* ── Bolhas — no container externo, sem nenhuma escala aplicada ── */}
        {!isEmpty &&
          STATE_COORDS.map((state) => {
            const d = dataByAbbr.get(state.abbr);
            if (!d || d.spend === 0) return null;

            const t     = d.spend / maxSpend;
            const diam  = 3 + t * 8;           // 3 px (mín) → 11 px (máx)
            const alpha = 0.45 + t * 0.45;    // 0.45 → 0.90

            const { cx, cy } = toContainerPct(state.x, state.y);

            return (
              <div
                key={state.abbr}
                className="absolute cursor-default"
                style={{
                  left:      `${cx}%`,
                  top:       `${cy}%`,
                  transform: "translate(-50%, -50%)",
                  width:     diam + 6,
                  height:    diam + 6,
                  zIndex:    2,
                }}
                onMouseEnter={() =>
                  setActive({ abbr: state.abbr, cx, cy, data: d })
                }
                onMouseLeave={() => setActive(null)}
              >
                {/* Halo suave */}
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: `rgba(23,31,56,${alpha * 0.14})` }}
                />
                {/* Núcleo #171F38 */}
                <span
                  className="absolute rounded-full"
                  style={{
                    width:     diam,
                    height:    diam,
                    top:       "50%",
                    left:      "50%",
                    transform: "translate(-50%, -50%)",
                    backgroundColor: `rgba(23,31,56,${alpha})`,
                    boxShadow: `0 0 ${Math.round(diam * 0.5)}px rgba(23,31,56,${alpha * 0.35})`,
                  }}
                />
              </div>
            );
          })}

        {/* ── Tooltip ───────────────────────────────────────────────────── */}
        {active && (() => {
          const xAlign =
            active.cx > 75 ? "-100%" :
            active.cx < 25 ? "0%"    :
            "-50%";
          const yAlign =
            active.cy > 65 ? "calc(-100% - 10px)" : "10px";

          const hasLeads    = active.data.leads > 0;
          const hasMessages = active.data.messages_started > 0;
          const hasResult   = hasLeads || hasMessages;

          return (
            <div
              className="absolute z-10 pointer-events-none"
              style={{
                left:      `${active.cx}%`,
                top:       `${active.cy}%`,
                transform: `translate(${xAlign}, ${yAlign})`,
              }}
            >
              <div className="rounded-xl bg-[#171f38]/93 backdrop-blur-sm px-3 py-2.5 shadow-xl whitespace-nowrap">
                <p className="text-[11px] font-semibold text-white leading-none mb-2.5">
                  {active.abbr}
                </p>
                <div className="flex flex-col gap-[5px]">
                  <div className="flex items-center justify-between gap-5">
                    <span className="text-[9px] text-white/40 font-light">Investimento</span>
                    <span className="text-[9px] text-white font-medium">
                      {fmtBRL(active.data.spend)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-5">
                    <span className="text-[9px] text-white/40 font-light">Impressões</span>
                    <span className="text-[9px] text-white font-medium">
                      {fmtNum(active.data.impressions)}
                    </span>
                  </div>
                  {hasLeads && (
                    <div className="flex items-center justify-between gap-5">
                      <span className="text-[9px] text-white/40 font-light">Leads</span>
                      <span className="text-[9px] text-white font-medium">
                        {fmtNum(active.data.leads)}
                      </span>
                    </div>
                  )}
                  {hasMessages && (
                    <div className="flex items-center justify-between gap-5">
                      <span className="text-[9px] text-white/40 font-light">Mensagens</span>
                      <span className="text-[9px] text-white font-medium">
                        {fmtNum(active.data.messages_started)}
                      </span>
                    </div>
                  )}
                  {!hasResult && (
                    <div className="flex items-center justify-between gap-5">
                      <span className="text-[9px] text-white/40 font-light">Resultado</span>
                      <span className="text-[9px] text-white/35 font-light">—</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
