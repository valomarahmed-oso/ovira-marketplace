/**
 * Operator-authored HTML, reduced to blocks this app can draw.
 *
 * The four content pages come out of a Frappe text editor as HTML. A WebView
 * would render it faithfully and would also be a browser inside the app —
 * different fonts, its own scrolling, no dark mode. A full HTML engine is the
 * other extreme: a large dependency to display four pages an operator typed.
 *
 * So this handles what a rich-text editor actually emits — paragraphs,
 * headings, lists, links, line breaks — and treats everything else as text.
 * Unknown markup degrades to its words, which is the right failure: the
 * operator's sentence still reaches the reader.
 */

export type RichBlock = { kind: "p" | "h" | "li"; text: string; href?: string };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
};

function decode(text: string): string {
  return text.replace(/&(#?\w+);/g, (whole, code: string) => ENTITIES[code] ?? whole);
}

/** The first link in a block, so a paragraph that is a link becomes tappable. */
function firstHref(html: string): string | undefined {
  return /<a[^>]+href=["']([^"']+)["']/i.exec(html)?.[1];
}

function strip(html: string): string {
  return decode(
    html
      // A break is a line, not a missing space between two words.
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+/g, " "),
  ).trim();
}

export function parseRichText(html: string): RichBlock[] {
  if (!html) return [];

  const blocks: RichBlock[] = [];
  // Block-level tags only. Inline markup inside them is flattened by `strip`:
  // a paragraph with one bold word does not need a text-run tree.
  const pattern = /<(h[1-6]|p|li|div)[^>]*>([\s\S]*?)<\/\1>/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const tag = (match[1] ?? "").toLowerCase();
    const inner = match[2] ?? "";
    const text = strip(inner);
    if (!text) continue;
    blocks.push({
      kind: tag.startsWith("h") ? "h" : tag === "li" ? "li" : "p",
      text,
      href: firstHref(inner),
    });
  }

  // No block tags at all — a plain sentence typed straight into the field.
  if (!blocks.length) {
    for (const line of strip(html).split("\n")) {
      if (line.trim()) blocks.push({ kind: "p", text: line.trim() });
    }
  }
  return blocks;
}
