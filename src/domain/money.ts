/**
 * Money is stored as integer paise everywhere. These helpers are the only place strings and
 * paise convert, so float rounding errors never reach the database.
 */

/** "1,23,456.7" / "500" / "99.50" -> paise. Returns null for anything that isn't a plain amount. */
export function parseRupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/,/g, '').trim();
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) {
    return null;
  }
  const rupees = Number(match[1]);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const paise = rupees * 100 + Number(fraction);
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Indian digit grouping: 123456789 paise -> "₹12,34,567.89". Whole rupees drop ".00". */
export function formatPaise(
  paise: number,
  options: { sign?: boolean } = {},
): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const fraction = abs % 100;

  const digits = String(rupees);
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest
    ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`
    : lastThree;

  const body =
    fraction === 0
      ? grouped
      : `${grouped}.${String(fraction).padStart(2, '0')}`;
  const prefix = negative ? '-' : options.sign ? '+' : '';
  return `${prefix}₹${body}`;
}
