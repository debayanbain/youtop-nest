/**
 * Shared defensive date parser for Indian government sources — used by all
 * scrapers (spec Phase 3.6) so parsing logic isn't duplicated per source.
 * Government sites mix `DD-MM-YYYY`, `DD/MM/YYYY`, `DD.MM.YYYY`, `27 July 2026`,
 * `July 27, 2026`, and ISO timestamps (e.g. SSC's `createdAt`). Returns a
 * calendar date string `YYYY-MM-DD`, or undefined when nothing parses — never
 * throws, never guesses an ambiguous US `MM/DD` reading (India is day-first).
 */

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function iso(y: number, m: number, d: number): string | undefined {
  if (y < 2000 || y > 2100) return undefined;
  if (m < 1 || m > 12) return undefined;
  if (d < 1 || d > 31) return undefined;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}`;
}

export function parseIndianDate(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;

  // ISO date / datetime (SSC createdAt, RSS isoDate): take the date part.
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return iso(+isoMatch[1], +isoMatch[2], +isoMatch[3]);
  }

  // Day-first numeric: DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY (2- or 4-digit year).
  const dmy = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (dmy) {
    const [, d, m, y] = dmy;
    let year = +y;
    if (year < 100) year += 2000;
    return iso(year, +m, +d);
  }

  // "27 July 2026" / "27 Jul 2026" / "27th July, 2026".
  const dmonY = s.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/,
  );
  if (dmonY) {
    const mo =
      MONTHS[
        dmonY[2]
          .toLowerCase()
          .slice(0, dmonY[2].toLowerCase() === 'sept' ? 4 : 3)
      ];
    if (mo) return iso(+dmonY[3], mo, +dmonY[1]);
  }

  // "July 27, 2026" / "Jul 27 2026".
  const monDY = s.match(
    /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/,
  );
  if (monDY) {
    const mo =
      MONTHS[
        monDY[1]
          .toLowerCase()
          .slice(0, monDY[1].toLowerCase() === 'sept' ? 4 : 3)
      ];
    if (mo) return iso(+monDY[3], mo, +monDY[2]);
  }

  return undefined;
}
