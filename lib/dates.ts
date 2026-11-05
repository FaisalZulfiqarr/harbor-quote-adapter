/**
 * Calendar dates as plain year/month/day. Going through `new Date("1994-03-12")`
 * parses as UTC and can land on the previous day in US timezones, which is
 * enough to shift a birth date or an age check.
 */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function isRealDate({ year, month, day }: CalendarDate): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** Parses a date string against a format made of YYYY, MM and DD tokens. */
export function parseDate(value: string, format: string): CalendarDate | null {
  const tokens: string[] = [];
  const pattern = format.replace(/YYYY|MM|DD/g, (token) => {
    tokens.push(token);
    return token === "YYYY" ? "(\\d{4})" : "(\\d{2})";
  });
  const match = new RegExp(`^${pattern}$`).exec(value);
  if (!match) return null;

  const part = (token: string) => Number(match[tokens.indexOf(token) + 1]);
  const date = { year: part("YYYY"), month: part("MM"), day: part("DD") };
  return isRealDate(date) ? date : null;
}

export function formatDate({ year, month, day }: CalendarDate, format: string): string {
  return format
    .replace("YYYY", String(year).padStart(4, "0"))
    .replace("MM", String(month).padStart(2, "0"))
    .replace("DD", String(day).padStart(2, "0"));
}

/** Age in completed years. Someone turning 21 today counts as 21. */
export function ageOn(birth: CalendarDate, on: CalendarDate): number {
  const hadBirthday =
    on.month > birth.month || (on.month === birth.month && on.day >= birth.day);
  return on.year - birth.year - (hadBirthday ? 0 : 1);
}

/** Today in the viewer's own timezone. */
export function today(): CalendarDate {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}
