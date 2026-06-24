/**
 * Timezone helpers to convert date/times into UTC ranges for database queries.
 * Handles the America/Sao_Paulo timezone (UTC-3).
 */

export function getSaoPauloDayRange(date: Date): { start: Date; end: Date } {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const dateStr = formatter.format(date); // "YYYY-MM-DD"
  
  // Brazil is currently standard UTC-3 (no daylight saving time)
  const start = new Date(`${dateStr}T00:00:00.000-03:00`);
  const end = new Date(`${dateStr}T23:59:59.999-03:00`);
  return { start, end };
}

export function getSaoPauloMonthRange(date: Date): { start: Date; end: Date } {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit'
  });
  const monthStr = formatter.format(date); // "YYYY-MM"
  
  const start = new Date(`${monthStr}-01T00:00:00.000-03:00`);
  
  const [yStr, mStr] = monthStr.split('-');
  let nextYear = parseInt(yStr, 10);
  let nextMonth = parseInt(mStr, 10) + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  const nextMonthStart = new Date(`${nextMonthStr}-01T00:00:00.000-03:00`);
  
  const end = new Date(nextMonthStart.getTime() - 1);
  return { start, end };
}
