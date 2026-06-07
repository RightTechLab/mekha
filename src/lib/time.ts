const BANGKOK_TIME_ZONE = 'Asia/Bangkok';

function parseSqliteUtcDate(value: string): Date {
  if (value.includes('T')) return new Date(value);
  return new Date(`${value.replace(' ', 'T')}Z`);
}

export function formatBangkokDateTime(value: string): string {
  const date = parseSqliteUtcDate(value);
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: BANGKOK_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatBangkokDate(value: string | Date = new Date()): string {
  const date = typeof value === 'string' ? parseSqliteUtcDate(value) : value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatBangkokTime(value: string): string {
  const date = parseSqliteUtcDate(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function getBangkokDateKey(date: Date = new Date()): string {
  return formatBangkokDate(date);
}

export function sqliteBangkokDateExpr(columnName: string): string {
  return `date(${columnName}, '+7 hours')`;
}
