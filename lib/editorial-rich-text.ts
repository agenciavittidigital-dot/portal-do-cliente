import React from "react";

// ── Color palette ──────────────────────────────────────────────────────────────
export const COLOR_PALETTE: Record<string, string> = {
  blue:  "#455CAB",
  red:   "#EF4444",
  green: "#16A34A",
  amber: "#D97706",
  gray:  "#6B7280",
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RichStyle {
  bold?:      boolean;
  italic?:    boolean;
  underline?: boolean;
  highlight?: boolean;
  color?:     string; // key from COLOR_PALETTE
}

export interface CanonSegment {
  canonStart:   number;
  canonEnd:     number; // exclusive
  content:      string; // visible text (no markup)
  style:        RichStyle;
  listContext?: "bullet" | "ordered";
  isNewline?:   boolean;
}

// ── Placeholder mechanism ──────────────────────────────────────────────────────
// Escaped delimiters (\*, \_, etc.) are swapped to PUA chars before tokenisation
// so the regex never mistakes them for markup. Restored to plain chars afterwards.

const CH_BACKSLASH  = "";
const CH_STAR       = "";
const CH_UNDERSCORE = "";
const CH_EQUALS     = "";
const CH_LBRACKET   = "";
const CH_RBRACKET   = "";
const CH_LBRACE     = "";
const CH_RBRACE     = "";
const CH_DASH       = "";
const CH_DOT        = "";

// Order matters for escapePH: \\ must be first so it doesn't double-escape.
const ESC_TO_PH: [RegExp, string][] = [
  [/\\\\/g, CH_BACKSLASH],
  [/\\\*/g, CH_STAR],
  [/\\_/g,  CH_UNDERSCORE],
  [/\\=/g,  CH_EQUALS],
  [/\\\[/g, CH_LBRACKET],
  [/\\\]/g, CH_RBRACKET],
  [/\\\{/g, CH_LBRACE],
  [/\\\}/g, CH_RBRACE],
  [/\\-/g,  CH_DASH],
  [/\\\./g, CH_DOT],
];

// Restore in reverse order; use split/join to avoid regex with PUA chars in pattern.
const PH_TO_CHAR: [string, string][] = [
  [CH_DOT,        "."],
  [CH_DASH,       "-"],
  [CH_RBRACE,     "}"],
  [CH_LBRACE,     "{"],
  [CH_RBRACKET,   "]"],
  [CH_LBRACKET,   "["],
  [CH_EQUALS,     "="],
  [CH_UNDERSCORE, "_"],
  [CH_STAR,       "*"],
  [CH_BACKSLASH,  "\\"],
];

function escapePH(s: string): string {
  for (const [re, ph] of ESC_TO_PH) s = s.replace(re, ph);
  return s;
}

function restorePH(s: string): string {
  for (const [ph, ch] of PH_TO_CHAR) s = s.split(ph).join(ch);
  return s;
}

// ── Token regex ────────────────────────────────────────────────────────────────
// ___ must precede __ and _ to avoid partial-match on longer sequences.
// Lookbehind/lookahead guarantee exact underscore-count, so any nesting order
// between italic, underline, and italic+underline parses correctly.

function makeToken(): RegExp {
  return /(?<!_)___(?!_)(.+?)(?<!_)___(?!_)|\*\*(.+?)\*\*|(?<!_)__(?!_)(.+?)(?<!_)__(?!_)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)|==(.+?)==|\[(.+?)\]\{:(blue|red|green|amber|gray)\}/g;
}

interface TokenMeta { style: RichStyle; innerStart: number; innerEnd: number }

function tokenMeta(raw: string): TokenMeta {
  if (raw.startsWith("___"))
    return { style: { italic: true, underline: true }, innerStart: 3, innerEnd: raw.length - 3 };
  if (raw.startsWith("**"))
    return { style: { bold: true },      innerStart: 2, innerEnd: raw.length - 2 };
  if (raw.startsWith("__"))
    return { style: { underline: true }, innerStart: 2, innerEnd: raw.length - 2 };
  if (raw.startsWith("_"))
    return { style: { italic: true },    innerStart: 1, innerEnd: raw.length - 1 };
  if (raw.startsWith("=="))
    return { style: { highlight: true }, innerStart: 2, innerEnd: raw.length - 2 };
  if (raw.startsWith("[")) {
    const cm = raw.match(/\]\{:(blue|red|green|amber|gray)\}$/);
    return { style: { color: cm ? cm[1] : "gray" }, innerStart: 1, innerEnd: cm ? raw.length - cm[0].length : raw.length };
  }
  return { style: {}, innerStart: 0, innerEnd: raw.length };
}

function mergeStyle(a: RichStyle, b: RichStyle): RichStyle {
  const m: RichStyle = {};
  if (a.bold      || b.bold)      m.bold      = true;
  if (a.italic    || b.italic)    m.italic    = true;
  if (a.underline || b.underline) m.underline = true;
  if (a.highlight || b.highlight) m.highlight = true;
  const c = b.color ?? a.color;
  if (c) m.color = c;
  return m;
}

function styleFingerprint(s: RichStyle): string {
  const p: string[] = [];
  if (s.bold)      p.push("b");
  if (s.italic)    p.push("i");
  if (s.underline) p.push("u");
  if (s.highlight) p.push("h");
  if (s.color)     p.push(`c:${s.color}`);
  return p.join(",");
}

// ── Canonical serializer ───────────────────────────────────────────────────────
// Converts RichStyle + content into canonical markup string.
// Order (outermost → innermost): bold > ___/italic/underline > highlight > color

export function serializeStyle(style: RichStyle, content: string): string {
  let s = content;
  if (style.color)     s = `[${s}]{:${style.color}}`;
  if (style.highlight) s = `==${s}==`;
  if (style.italic && style.underline) {
    s = `___${s}___`;
  } else {
    if (style.underline) s = `__${s}__`;
    if (style.italic)    s = `_${s}_`;
  }
  if (style.bold) s = `**${s}**`;
  return s;
}

// ── escapeForRich ──────────────────────────────────────────────────────────────
// Escapes client-supplied plain text so it can be embedded in rich markup safely.

export function escapeForRich(text: string): string {
  let s = text
    .replace(/\\/g,  "\\\\")
    .replace(/\*/g,  "\\*")
    .replace(/_/g,   "\\_")
    .replace(/=/g,   "\\=")
    .replace(/\[/g,  "\\[")
    .replace(/\]/g,  "\\]")
    .replace(/\{/g,  "\\{")
    .replace(/\}/g,  "\\}");
  // Escape list prefixes at line-start so they render as literal text.
  s = s
    .replace(/^- /gm,       "\\- ")
    .replace(/^(\d+)\. /gm, "$1\\. ");
  return s;
}

// ── stripEditorialRichText ─────────────────────────────────────────────────────
// Removes all markup and escape sequences, returning canonical plain text.

export function stripEditorialRichText(text: string): string {
  let s = escapePH(text);

  // Iterative strip handles any nesting order.
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s
      .replace(/(?<!_)___(?!_)(.+?)(?<!_)___(?!_)/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/(?<!_)__(?!_)(.+?)(?<!_)__(?!_)/g,   "$1")
      .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g,     "$1")
      .replace(/==(.+?)==/g,                          "$1")
      .replace(/\[(.+?)\]\{:(?:blue|red|green|amber|gray)\}/g, "$1");
  }

  // Strip list prefixes.
  s = s.replace(/^- /gm, "").replace(/^\d+\. /gm, "");

  return restorePH(s);
}

// ── validateRichMarkup ─────────────────────────────────────────────────────────

export function validateRichMarkup(
  rich: string,
  canonText: string,
): { valid: boolean; errors: string[] } {
  const stripped = stripEditorialRichText(rich);
  if (stripped !== canonText) {
    return {
      valid:  false,
      errors: ["Inconsistência rich↔canonical: strip não produziu o texto esperado."],
    };
  }
  return { valid: true, errors: [] };
}

// ── Internal React renderer ────────────────────────────────────────────────────

type RNode = string | { style: RichStyle; children: RNode[] };

function parseRNodes(text: string, inherited: RichStyle = {}): RNode[] {
  const TOKEN = makeToken();
  const nodes: RNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) nodes.push(restorePH(text.slice(last, m.index)));
    const { style, innerStart, innerEnd } = tokenMeta(m[0]);
    const combined = mergeStyle(inherited, style);
    nodes.push({ style: combined, children: parseRNodes(m[0].slice(innerStart, innerEnd), combined) });
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(restorePH(text.slice(last)));
  return nodes;
}

function styleToCSS(style: RichStyle): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (style.bold)      css.fontWeight     = "bold";
  if (style.italic)    css.fontStyle      = "italic";
  if (style.underline) css.textDecoration = "underline";
  if (style.highlight) {
    css.backgroundColor = "#FEF08A";
    css.color           = "#000";
    css.borderRadius    = "2px";
    css.padding         = "0 2px";
  }
  if (style.color) css.color = COLOR_PALETTE[style.color] ?? style.color;
  return css;
}

function renderRNodes(nodes: RNode[], keyPrefix: string): React.ReactNode[] {
  return nodes.flatMap((n, i): React.ReactNode[] => {
    if (typeof n === "string") return n ? [n] : [];
    return [
      React.createElement(
        "span",
        { key: `${keyPrefix}-${i}`, style: styleToCSS(n.style) },
        ...renderRNodes(n.children, `${keyPrefix}-${i}`),
      ),
    ];
  });
}

// ── parseEditorialRichText (public block renderer) ─────────────────────────────

export function parseEditorialRichText(text: string): React.ReactNode {
  const esc = escapePH(text);
  const lines = esc.split("\n");
  const result: React.ReactNode[] = [];
  let bi = 0;
  let i  = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("- ")) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        const rn = parseRNodes(lines[i].slice(2));
        items.push(React.createElement("li", { key: i }, ...renderRNodes(rn, `li-${i}`)));
        i++;
      }
      result.push(React.createElement("ul", {
        key:   `ul-${bi++}`,
        style: { paddingLeft: "1.25rem", margin: "0.25rem 0", listStyleType: "disc" },
      }, ...items));
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const rn = parseRNodes(lines[i].replace(/^\d+\. /, ""));
        items.push(React.createElement("li", { key: i }, ...renderRNodes(rn, `oli-${i}`)));
        i++;
      }
      result.push(React.createElement("ol", {
        key:   `ol-${bi++}`,
        style: { paddingLeft: "1.25rem", margin: "0.25rem 0", listStyleType: "decimal" },
      }, ...items));
      continue;
    }

    if (line === "") {
      result.push(React.createElement("br", { key: `br-${bi++}` }));
    } else {
      const rn = parseRNodes(line);
      result.push(React.createElement("span", {
        key:   `p-${bi}`,
        style: { display: "block" },
      }, ...renderRNodes(rn, `p-${bi}`)));
      bi++;
    }
    i++;
  }

  return React.createElement(React.Fragment, null, ...result);
}

// ── parseRichIntoCanonSegments ─────────────────────────────────────────────────
// Produces flat segments with canonical byte positions + merged RichStyle.
// Used by SuggestionInlineHighlight to render formatted text while preserving
// selection-offset logic (data-canonical-start attributes).

function flattenLineSegs(
  text: string,
  inherited: RichStyle,
): Array<{ content: string; style: RichStyle }> {
  const TOKEN = makeToken();
  const segs: Array<{ content: string; style: RichStyle }> = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) {
      const plain = restorePH(text.slice(last, m.index));
      if (plain) segs.push({ content: plain, style: inherited });
    }
    const { style, innerStart, innerEnd } = tokenMeta(m[0]);
    const combined = mergeStyle(inherited, style);
    segs.push(...flattenLineSegs(m[0].slice(innerStart, innerEnd), combined));
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    const plain = restorePH(text.slice(last));
    if (plain) segs.push({ content: plain, style: inherited });
  }
  return segs;
}

export function parseRichIntoCanonSegments(rich: string): CanonSegment[] {
  const esc = escapePH(rich);
  const lines = esc.split("\n");
  const result: CanonSegment[] = [];
  let canonPos = 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];

    let listContext: "bullet" | "ordered" | undefined;
    let lineContent: string;

    if (line.startsWith("- ")) {
      listContext  = "bullet";
      lineContent  = line.slice(2);
    } else if (/^\d+\. /.test(line)) {
      listContext  = "ordered";
      lineContent  = line.replace(/^\d+\. /, "");
    } else {
      lineContent  = line;
    }

    for (const seg of flattenLineSegs(lineContent, {})) {
      const len = seg.content.length;
      result.push({
        canonStart: canonPos,
        canonEnd:   canonPos + len,
        content:    seg.content,
        style:      seg.style,
        listContext,
      });
      canonPos += len;
    }

    if (li < lines.length - 1) {
      result.push({ canonStart: canonPos, canonEnd: canonPos + 1, content: "\n", style: {}, isNewline: true });
      canonPos += 1;
    }
  }

  return result;
}

// ── renderRichRange ────────────────────────────────────────────────────────────
// Renders a sub-range [rangeStart, rangeEnd) of canon segments with
// data-canonical-start attributes. Used by SuggestionInlineHighlight.

export function renderRichRange(
  segments: CanonSegment[],
  rangeStart: number,
  rangeEnd:   number,
  keyPrefix:  string,
): React.ReactNode[] {
  const inRange = segments.filter(
    (s) => !s.isNewline && s.canonEnd > rangeStart && s.canonStart < rangeEnd,
  );

  return inRange.map((seg, i) => {
    const clampStart = Math.max(seg.canonStart, rangeStart);
    const clampEnd   = Math.min(seg.canonEnd,   rangeEnd);
    const content    = seg.content.slice(clampStart - seg.canonStart, clampEnd - seg.canonStart);
    return React.createElement("span", {
      key:                    `${keyPrefix}-${i}`,
      "data-canonical-start": String(clampStart),
      style:                  styleToCSS(seg.style),
    }, content);
  });
}

// ── applyCanonChangeToRich ─────────────────────────────────────────────────────
// Applies canonical substitution [S, E) → proposedText to rich markup.
// Returns updated rich string, or null (caller should set _rich column to null).

function getUniformStyle(styles: RichStyle[]): RichStyle | null {
  const nonempty = styles.filter((s) => styleFingerprint(s) !== "");
  if (nonempty.length === 0) return null;
  const fp = styleFingerprint(nonempty[0]);
  if (nonempty.some((s) => styleFingerprint(s) !== fp)) return null;
  return nonempty[0];
}

export function applyCanonChangeToRich(
  rich:         string,
  S:            number,
  E:            number,
  proposedText: string,
): string | null {
  const segments = parseRichIntoCanonSegments(rich);
  if (segments.length === 0) return null;

  const affected = segments.filter(
    (seg) => !seg.isNewline && seg.canonEnd > S && seg.canonStart < E,
  );
  const uniformStyle   = getUniformStyle(affected.map((s) => s.style));
  const escapedProp    = escapeForRich(proposedText);
  const formattedProp  = uniformStyle ? serializeStyle(uniformStyle, escapedProp) : escapedProp;

  let result           = "";
  let proposedInserted = false;
  let prevWasLineBound = true;
  let orderedCounter   = 0;

  for (const seg of segments) {
    if (seg.isNewline) {
      const inRange = seg.canonStart >= S && seg.canonStart < E;
      if (!inRange) result += "\n";
      prevWasLineBound = true;
      orderedCounter   = 0;
      continue;
    }

    if (prevWasLineBound && seg.listContext === "bullet")   result += "- ";
    if (prevWasLineBound && seg.listContext === "ordered") { orderedCounter++; result += `${orderedCounter}. `; }
    prevWasLineBound = false;

    if (seg.canonEnd <= S) {
      result += serializeStyle(seg.style, escapeForRich(seg.content));
    } else if (seg.canonStart >= E) {
      if (!proposedInserted) { result += formattedProp; proposedInserted = true; }
      result += serializeStyle(seg.style, escapeForRich(seg.content));
    } else {
      const keepBefore = seg.canonStart < S
        ? seg.content.slice(0, S - seg.canonStart) : "";
      const keepAfter = seg.canonEnd > E
        ? seg.content.slice(E - seg.canonStart)    : "";
      if (keepBefore) result += serializeStyle(seg.style, escapeForRich(keepBefore));
      if (!proposedInserted) { result += formattedProp; proposedInserted = true; }
      if (keepAfter)  result += serializeStyle(seg.style, escapeForRich(keepAfter));
    }
  }

  if (!proposedInserted) result += formattedProp;

  const originalCanon = stripEditorialRichText(rich);
  const newCanon      = originalCanon.slice(0, S) + proposedText + originalCanon.slice(E);
  const { valid }     = validateRichMarkup(result, newCanon);
  return valid ? result : null;
}
