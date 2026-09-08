export type Align = "left" | "right";
export type Column = { header: string; align?: Align };

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/**
 * Renders a light box-drawing table. Widths are measured on the visible text,
 * so cells that already contain ANSI colour codes still line up.
 */
export function table(columns: Column[], rows: string[][], indent = "  "): string {
  const widths = columns.map((column, index) =>
    Math.max(
      visibleWidth(column.header),
      ...rows.map((row) => visibleWidth(row[index] ?? "")),
    ),
  );

  const rule = (left: string, mid: string, right: string) =>
    indent + left + widths.map((width) => "─".repeat(width + 2)).join(mid) + right;

  const renderRow = (cells: string[]) =>
    `${indent}│` +
    widths
      .map((width, index) => ` ${pad(cells[index] ?? "", width, columns[index].align)} `)
      .join("│") +
    "│";

  return [
    rule("┌", "┬", "┐"),
    renderRow(columns.map((column) => column.header)),
    rule("├", "┼", "┤"),
    ...rows.map(renderRow),
    rule("└", "┴", "┘"),
  ].join("\n");
}

function pad(value: string, width: number, align: Align = "left"): string {
  const spaces = " ".repeat(Math.max(0, width - visibleWidth(value)));
  return align === "right" ? spaces + value : value + spaces;
}

/** Counts printable columns, ignoring ANSI escapes and counting CJK as two. */
export function visibleWidth(value: string): number {
  let width = 0;
  for (const char of stripAnsi(value)) {
    const code = char.codePointAt(0) ?? 0;
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0x1f300 && code <= 0x1f9ff);
    width += wide ? 2 : 1;
  }
  return width;
}

export function stripAnsi(value: string): string {
  return value.replace(ANSI, "");
}

/** Shortens to `max` visible columns, adding an ellipsis when it cuts. */
export function truncate(value: string, max: number): string {
  const plain = stripAnsi(value);
  if (plain.length <= max) return value;
  return `${plain.slice(0, Math.max(0, max - 1))}…`;
}
