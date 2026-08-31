import React from "react";

const COLOR_PALETTE: Record<string, string> = {
  blue:  "#455CAB",
  red:   "#EF4444",
  green: "#16A34A",
  amber: "#D97706",
  gray:  "#6B7280",
};

// ── inline parser ──────────────────────────────────────────────────────────────
// Processes a single line (no block elements) and returns React nodes.
function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Token regex — ordered by specificity (longer/specific markers first)
  const TOKEN = /(\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|==(.+?)==|\[(.+?)\]\{:(blue|red|green|amber|gray)\})/g;

  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }

    const raw = m[0];
    const key = `${keyPrefix}-i${idx++}`;

    if (raw.startsWith("**")) {
      nodes.push(React.createElement("strong", { key }, m[2]));
    } else if (raw.startsWith("__")) {
      nodes.push(React.createElement("span", { key, style: { textDecoration: "underline" } }, m[3]));
    } else if (raw.startsWith("_")) {
      nodes.push(React.createElement("em", { key }, m[4]));
    } else if (raw.startsWith("==")) {
      nodes.push(
        React.createElement("mark", {
          key,
          style: { backgroundColor: "#FEF08A", color: "#000", borderRadius: "2px", padding: "0 2px" },
        }, m[5])
      );
    } else if (raw.startsWith("[")) {
      const color = COLOR_PALETTE[m[7]] ?? COLOR_PALETTE.gray;
      nodes.push(React.createElement("span", { key, style: { color } }, m[6]));
    }

    last = m.index + raw.length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes;
}

// ── block parser ───────────────────────────────────────────────────────────────
export function parseEditorialRichText(text: string): React.ReactNode {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;
  let blockIdx = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bullet list: consecutive lines starting with "- "
    if (line.startsWith("- ")) {
      const items: React.ReactNode[] = [];
      let j = i;
      while (j < lines.length && lines[j].startsWith("- ")) {
        const content = lines[j].slice(2);
        items.push(
          React.createElement("li", { key: j }, parseInline(content, `li-${j}`))
        );
        j++;
      }
      result.push(
        React.createElement("ul", {
          key: `ul-${blockIdx++}`,
          style: { paddingLeft: "1.25rem", margin: "0.25rem 0", listStyleType: "disc" },
        }, ...items)
      );
      i = j;
      continue;
    }

    // Ordered list: consecutive lines starting with digit(s) + ". "
    if (/^\d+\. /.test(line)) {
      const items: React.ReactNode[] = [];
      let j = i;
      while (j < lines.length && /^\d+\. /.test(lines[j])) {
        const content = lines[j].replace(/^\d+\. /, "");
        items.push(
          React.createElement("li", { key: j }, parseInline(content, `oli-${j}`))
        );
        j++;
      }
      result.push(
        React.createElement("ol", {
          key: `ol-${blockIdx++}`,
          style: { paddingLeft: "1.25rem", margin: "0.25rem 0", listStyleType: "decimal" },
        }, ...items)
      );
      i = j;
      continue;
    }

    // Plain paragraph / empty line
    if (line === "") {
      result.push(React.createElement("br", { key: `br-${blockIdx++}` }));
    } else {
      result.push(
        React.createElement("span", {
          key: `p-${blockIdx++}`,
          style: { display: "block" },
        }, parseInline(line, `p-${blockIdx}`))
      );
    }
    i++;
  }

  return React.createElement(React.Fragment, null, ...result);
}

// ── strip all markup → plain text ──────────────────────────────────────────────
export function stripEditorialRichText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/==(.+?)==/g, "$1")
    .replace(/\[(.+?)\]\{:(?:blue|red|green|amber|gray)\}/g, "$1");
}

export { COLOR_PALETTE };
