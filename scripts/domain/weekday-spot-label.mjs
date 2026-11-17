// @ts-nocheck
/** Browser-safe weekday spot labels for offer cards (no Node-only imports). */

const WEEKDAY_SHORT_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** @param {number[]} weekdays Sunday=0 … Saturday=6 */
export function formatWeekdaySpotLabel(weekdays) {
  if (!weekdays?.length) return "";
  return weekdays.map((dow) => WEEKDAY_SHORT_PT[dow] ?? "").filter(Boolean).join("–");
}