/**
 * Ethiopian Calendar Conversion — LifeOS
 *
 * Converts Gregorian dates to Ethiopian calendar dates using the JDN algorithm.
 * The Ethiopian calendar has 13 months: 12 × 30 days + Pagume (5 or 6 days).
 * It runs ~7-8 years behind the Gregorian calendar.
 * Ethiopian New Year (Meskerem 1) falls on September 11 (or 12 in Gregorian leap year).
 */

const ETHIOPIAN_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume',
] as const;

export interface EthiopianDate {
  year: number;
  month: number;   // 1-13
  day: number;     // 1-30 (1-5/6 for Pagume)
  monthName: string;
}

/**
 * Convert a Gregorian date to Julian Day Number.
 */
function gregorianToJDN(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * Convert a Julian Day Number to an Ethiopian calendar date.
 * The Ethiopian calendar epoch in JDN is August 29, 8 CE (Julian) = JDN 1724221.
 */
function jdnToEthiopian(jdn: number): EthiopianDate {
  // Ethiopian epoch: JDN of Meskerem 1, 1 EC = 1724221
  const ETHIOPIAN_EPOCH = 1724221;

  const r = (jdn - ETHIOPIAN_EPOCH) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);

  const year = 4 * Math.floor((jdn - ETHIOPIAN_EPOCH) / 1461) +
    Math.floor(r / 365) -
    Math.floor(r / 1460);

  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;

  return {
    year,
    month,
    day,
    monthName: ETHIOPIAN_MONTHS[month - 1] || 'Pagume',
  };
}

/**
 * Convert a JS Date to an Ethiopian calendar date.
 */
export function toEthiopianDate(date: Date): EthiopianDate {
  const jdn = gregorianToJDN(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  return jdnToEthiopian(jdn);
}

/**
 * Format a Gregorian date as an Ethiopian date string.
 * Example: "Megabit 8, 2018 EC"
 */
export function formatEthiopianDate(date: Date): string {
  const eth = toEthiopianDate(date);
  return `${eth.monthName} ${eth.day}, ${eth.year} EC`;
}
