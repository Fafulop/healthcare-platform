/** Normalize ALL CAPS or weird casing to Title Case (e.g. "CIRUJANA BARIATRA" → "Cirujana Bariatra") */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\S/g, (match) => match.toUpperCase());
}
