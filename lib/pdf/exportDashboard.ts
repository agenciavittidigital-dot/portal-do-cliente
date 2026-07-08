export interface ExportDashboardOptions {
  containerEl: HTMLElement;
  clientName: string;
  platformLabel: string;
  periodLabel: string;
}

// ── A4 landscape layout constants (mm) ──────────────────────────────────────
const PAGE_W   = 297;
const PAGE_H   = 210;
const MARGIN   = 10;
const HEADER_H = 22;
const CONTENT_W = PAGE_W - 2 * MARGIN;   // 277 mm — usable width
const CONTENT_H = PAGE_H - 2 * MARGIN - HEADER_H;  // 168 mm — usable per page
const GAP_MM    = 5;  // vertical gap between sections on the same page

export async function exportDashboardToPdf(opts: ExportDashboardOptions): Promise<void> {
  const { containerEl, clientName, platformLabel, periodLabel } = opts;

  const [{ toCanvas }, { default: jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const origin = window.location.origin;
  const BLANK_GIF =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

  // ── 1. Blank external images before capture (CORS) ──────────────────────────
  const externalImgs = new Map<HTMLImageElement, { src: string; opacity: string }>();
  containerEl.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (/^https?:\/\//.test(src) && !src.startsWith(origin)) {
      externalImgs.set(img, { src, opacity: img.style.opacity });
      img.setAttribute("src", BLANK_GIF);
      img.style.opacity = "0";
    }
  });

  // ── 2. Fix card visuals for capture ─────────────────────────────────────────
  // Cards use bg-white/60 + backdrop-blur-xl. Inside SVG foreignObject:
  //   • backdrop-filter is ignored → card appears translucent over nothing
  //   • Result: washed-out, "floating" look
  // Fix: temporarily remove backdrop-filter and raise background opacity so
  // cards render with a solid, readable background in the PDF.
  const fixedEls: Array<{
    el: HTMLElement;
    prevBF: string;
    prevBG: string;
  }> = [];

  containerEl.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const cs = window.getComputedStyle(el);
    const bf = cs.backdropFilter ?? "";
    const bg = cs.backgroundColor ?? "";
    if (bf && bf !== "none") {
      fixedEls.push({
        el,
        prevBF: el.style.backdropFilter ?? "",
        prevBG: el.style.backgroundColor ?? "",
      });
      el.style.backdropFilter = "none";
      (el.style as CSSStyleDeclaration & { webkitBackdropFilter: string }).webkitBackdropFilter = "none";
      // If the background has low opacity (e.g. rgba(255,255,255,0.6)) make it solid
      if (/rgba/.test(bg)) {
        el.style.backgroundColor = bg.replace(/,\s*[\d.]+\)$/, ", 1)");
      }
    }
  });

  // ── 3. Identify capture targets ──────────────────────────────────────────────
  // If sections are marked with data-pdf-section we capture each independently.
  // Otherwise fall back to capturing the full container.
  const sectionEls = Array.from(
    containerEl.querySelectorAll<HTMLElement>("[data-pdf-section]")
  );
  const targets: HTMLElement[] = sectionEls.length > 0 ? sectionEls : [containerEl];

  // ── 4. Capture sections ──────────────────────────────────────────────────────
  type SectionCanvas = { canvas: HTMLCanvasElement; heightMm: number };
  const sections: SectionCanvas[] = [];

  try {
    for (const target of targets) {
      const canvas = await toCanvas(target, {
        pixelRatio: 2,
        // Use the portal page surface color as background so card spacing
        // looks the same as in the browser
        backgroundColor: "#F8FAFC",
        style: { overflow: "visible" },
        filter: (node: Node): boolean => {
          if (node instanceof Element && node.hasAttribute("data-pdf-hide")) {
            return false;
          }
          return true;
        },
      });

      const scale = CONTENT_W / canvas.width;  // mm per pixel
      sections.push({ canvas, heightMm: canvas.height * scale });
    }
  } catch (captureErr) {
    console.warn(
      "[PDF Export] Captura falhou, gerando PDF simplificado.",
      captureErr instanceof Error ? captureErr.message : captureErr
    );
  } finally {
    // Restore external images
    externalImgs.forEach(({ src, opacity }, img) => {
      img.setAttribute("src", src);
      img.style.opacity = opacity;
    });
    // Restore card styles
    fixedEls.forEach(({ el, prevBF, prevBG }) => {
      el.style.backdropFilter = prevBF;
      (el.style as CSSStyleDeclaration & { webkitBackdropFilter: string }).webkitBackdropFilter = prevBF;
      el.style.backgroundColor = prevBG;
    });
  }

  // ── 5. Fallback PDF ──────────────────────────────────────────────────────────
  if (sections.length === 0) {
    const pdf = buildHeader(jsPDF, clientName, platformLabel, periodLabel, 1, 1);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      "Não foi possível capturar o visual do dashboard.",
      PAGE_W / 2, 118, { align: "center" }
    );
    pdf.text(
      "Tente novamente ou use a função de impressão do navegador (Ctrl+P).",
      PAGE_W / 2, 128, { align: "center" }
    );
    pdf.save(buildFilename(clientName));
    return;
  }

  // ── 6. Pre-simulate layout to get total page count ───────────────────────────
  // We run the EXACT same algorithm as the drawing phase (step 7) but without
  // rendering, so we know the total before drawing page headers.
  const totalPages = simulateLayout(sections.map((s) => s.heightMm));

  // ── 7. Build multi-page PDF ──────────────────────────────────────────────────
  const pdf = buildHeader(jsPDF, clientName, platformLabel, periodLabel, 1, totalPages);

  let currentY = MARGIN + HEADER_H;  // current insertion point (mm from top)
  let pageNum = 1;
  let firstOnPage = true;           // no gap before the first section on a page

  const sliceCanvas = document.createElement("canvas");
  const sliceCtx = sliceCanvas.getContext("2d")!;

  for (let i = 0; i < sections.length; i++) {
    const { canvas, heightMm } = sections[i];

    const extra  = firstOnPage ? 0 : GAP_MM;
    const availH = PAGE_H - MARGIN - currentY;

    // If section + gap doesn't fit and this isn't the only thing on the page → new page
    if (heightMm + extra > availH && !firstOnPage) {
      pdf.addPage();
      pageNum++;
      drawHeader(pdf, clientName, platformLabel, pageNum, totalPages);
      currentY     = MARGIN + HEADER_H;
      firstOnPage  = true;
    }

    const insertY = currentY + (firstOnPage ? 0 : extra);

    if (heightMm > CONTENT_H) {
      // ── Large section: slice across pages ───────────────────────────────────
      const scale       = CONTENT_W / canvas.width;
      const sliceHPx    = Math.round(CONTENT_H / scale);

      let sliceCount = 0;
      let sourceY    = 0;

      while (sourceY < canvas.height) {
        const sourceH  = Math.min(sliceHPx, canvas.height - sourceY);
        const sliceHMm = sourceH * scale;

        // For slices after the first on a new page
        if (sliceCount > 0) {
          pdf.addPage();
          pageNum++;
          drawHeader(pdf, clientName, platformLabel, pageNum, totalPages);
          currentY    = MARGIN + HEADER_H;
          firstOnPage = true;
        }

        sliceCanvas.width  = canvas.width;
        sliceCanvas.height = sourceH;
        sliceCtx.fillStyle = "#F8FAFC";
        sliceCtx.fillRect(0, 0, canvas.width, sourceH);
        sliceCtx.drawImage(
          canvas,
          0, sourceY, canvas.width, sourceH,
          0, 0,       canvas.width, sourceH
        );

        const y = sliceCount === 0 ? insertY : MARGIN + HEADER_H;
        pdf.addImage(
          sliceCanvas.toDataURL("image/jpeg", 0.92),
          "JPEG", MARGIN, y, CONTENT_W, sliceHMm,
          `s${i}c${sliceCount}`, "FAST"
        );

        currentY    = y + sliceHMm;
        firstOnPage = false;
        sourceY    += sourceH;
        sliceCount++;
      }
    } else {
      // ── Normal section: insert as one image ─────────────────────────────────
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.92),
        "JPEG", MARGIN, insertY, CONTENT_W, heightMm,
        `s${i}`, "FAST"
      );
      currentY    = insertY + heightMm;
      firstOnPage = false;
    }
  }

  pdf.save(buildFilename(clientName));
}

// ── Simulate layout — identical algorithm to the drawing loop ────────────────
function simulateLayout(heights: number[]): number {
  let y          = MARGIN + HEADER_H;
  let pages      = 1;
  let firstOnPg  = true;

  for (const h of heights) {
    const extra  = firstOnPg ? 0 : GAP_MM;
    const availH = PAGE_H - MARGIN - y;

    if (h + extra > availH && !firstOnPg) {
      pages++;
      y         = MARGIN + HEADER_H;
      firstOnPg = true;
    }

    if (h > CONTENT_H) {
      // Large section spans multiple pages
      const sliceH = CONTENT_H;
      let rem = h - (firstOnPg ? Math.min(h, PAGE_H - MARGIN - y) : Math.min(h, availH));
      if (!firstOnPg) y += extra;
      y += Math.min(h, PAGE_H - MARGIN - y);
      firstOnPg = false;

      while (rem > 0) {
        pages++;
        const thisH = Math.min(rem, CONTENT_H);
        rem        -= thisH;
        y           = MARGIN + HEADER_H + thisH;
        firstOnPg   = false;
      }
    } else {
      y        += h + extra;
      firstOnPg = false;
    }
  }

  return pages;
}

// ── PDF header builders ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHeader(jsPDF: any, clientName: string, platformLabel: string, periodLabel: string, page: number, total: number) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const now = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  // Fill the entire page with the portal surface colour first.
  // This gives margins, gaps between sections and the content area
  // the same #F8FAFC background the user sees in the browser.
  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Dark header band on top
  pdf.setFillColor(23, 31, 56);
  pdf.rect(0, 0, PAGE_W, HEADER_H, "F");

  // Left: brand
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Vitti Digital", MARGIN, 9);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(99, 138, 204);
  pdf.text("Portal do Cliente", MARGIN, 15);

  // Centre: client + platform + period
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`${clientName} · ${platformLabel}`, PAGE_W / 2, 9, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(180, 200, 230);
  pdf.text(`Período: ${periodLabel}`, PAGE_W / 2, 15.5, { align: "center" });

  // Right: generation time (page 1) or page number (subsequent pages)
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(140, 160, 200);
  if (page === 1) {
    pdf.text(`Gerado em: ${now}`, PAGE_W - MARGIN, 9, { align: "right" });
    if (total > 1) {
      pdf.text(`Página 1 de ${total}`, PAGE_W - MARGIN, 15, { align: "right" });
    }
  }

  return pdf;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawHeader(pdf: any, clientName: string, platformLabel: string, page: number, total: number) {
  // Same surface fill as buildHeader so every page has a consistent background
  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, 0, PAGE_W, PAGE_H, "F");

  pdf.setFillColor(23, 31, 56);
  pdf.rect(0, 0, PAGE_W, HEADER_H, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Vitti Digital", MARGIN, 9);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(99, 138, 204);
  pdf.text("Portal do Cliente", MARGIN, 15);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`${clientName} · ${platformLabel}`, PAGE_W / 2, 9, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(140, 160, 200);
  pdf.text(
    `Página ${page}${total > 1 ? ` de ${total}` : ""}`,
    PAGE_W - MARGIN, 9, { align: "right" }
  );
}

function buildFilename(clientName: string): string {
  const slug = clientName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const dateStr = new Date().toISOString().slice(0, 10);
  return `relatorio-${slug}-${dateStr}.pdf`;
}
