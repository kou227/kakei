import type { MonthRule } from "../types";

export type HouseholdMonth = {
  id: string;
  labelYear: number;
  labelMonth: number;
  startDay: number;
  startDate: string;
  endDate: string;
};

export function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateString(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addMonths(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

export function householdMonthId(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * MonthRule.effectiveFrom は、そのルールを使い始める
 * 「家計簿月ラベル」を YYYY-MM-01 で表す。
 *
 * 例:
 * effectiveFrom = "2026-09-01", startDay = 25
 * → 2026年9月分以降は25日開始。
 */
export function getStartDayForHouseholdMonth(
  rules: MonthRule[],
  year: number,
  month: number,
) {
  if (!rules.length) return 1;

  const labelKey =
    `${year}-${String(month).padStart(2, "0")}-01`;

  const sorted = [...rules].sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom),
  );

  const applicable = sorted.filter(
    (rule) => rule.effectiveFrom <= labelKey,
  );

  return (applicable.at(-1) ?? sorted[0]).startDay;
}

export function getHouseholdMonth(
  rules: MonthRule[],
  year: number,
  month: number,
): HouseholdMonth {
  const startDay = getStartDayForHouseholdMonth(
    rules,
    year,
    month,
  );

  const start = new Date(year, month - 1, startDay);

  /*
   * 重要:
   * この月の終了日は「この月自身の開始日」を基準に計算する。
   *
   * 例:
   * 2026年8月分が1日開始なら、
   * 次月に25日開始の変更予約があっても、
   * 8月分は 8/1〜8/31 のまま。
   *
   * 以前は次月の新しい開始日を使っていたため、
   * 8/1〜9/24 のように現在月が不自然に伸びていた。
   */
  const nextStart = new Date(year, month, startDay);
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);

  return {
    id: householdMonthId(year, month),
    labelYear: year,
    labelMonth: month,
    startDay,
    startDate: toDateString(start),
    endDate: toDateString(end),
  };
}

export function getCurrentHouseholdMonthLabel(
  rules: MonthRule[],
  today = new Date(),
) {
  if (!rules.length) {
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    };
  }

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const thisMonth = getHouseholdMonth(
    rules,
    currentYear,
    currentMonth,
  );

  const todayString = toDateString(today);

  if (todayString >= thisMonth.startDate) {
    return {
      year: currentYear,
      month: currentMonth,
    };
  }

  return addMonths(currentYear, currentMonth, -1);
}

export function formatShortDate(value: string) {
  const date = parseDateString(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatJapaneseDate(value: string) {
  const date = parseDateString(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
