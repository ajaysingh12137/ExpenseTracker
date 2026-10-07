/** Local-time ranges as [from, to) epoch ms. */

export function dayRange(date: Date = new Date()): [number, number] {
  const from = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const to = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  ).getTime();
  return [from, to];
}

export function monthRange(year: number, month: number): [number, number] {
  return [
    new Date(year, month, 1).getTime(),
    new Date(year, month + 1, 1).getTime(),
  ];
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${formatDate(ms)}, ${hour12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** "DD-MM-YYYY" -> epoch ms at the given time-of-day of `keepTimeFrom`, or null if invalid. */
export function parseDayInput(
  input: string,
  keepTimeFrom: number,
): number | null {
  const match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(input.trim());
  if (!match) {
    return null;
  }
  const [day, month, year] = [
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ];
  const time = new Date(keepTimeFrom);
  const date = new Date(year, month, day, time.getHours(), time.getMinutes());
  if (date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date.getTime();
}

export function toDayInput(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}-${String(
    d.getMonth() + 1,
  ).padStart(2, '0')}-${d.getFullYear()}`;
}
