export type CalendarRange = { from: string; to: string };
export const calendarDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function recentDays(days: number, now = new Date()): CalendarRange {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  return { from: calendarDate(start), to: calendarDate(now) };
}
export function rangeQuery(range: CalendarRange): string {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose both dates.');
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (calendarDate(date) !== value) throw new Error('Choose valid dates.');
    return date;
  };
  const start = parse(range.from), last = parse(range.to);
  if (last < start) throw new Error('End date must be on or after start date.');
  // Calendar arithmetic includes the entire end date, including 23/25-hour DST days.
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
  if (+end - +start > 366 * 86400000) throw new Error('Choose at most 366 days.');
  return new URLSearchParams({ startDate: start.toISOString(), endDate: end.toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).toString();
}
