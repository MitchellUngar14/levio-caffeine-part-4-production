/**
 * Repairs data that comes from outside the running app: an imported backup
 * file, or whatever an earlier version left in localStorage. Settings fall
 * back field by field; entries that don't make sense are dropped. Pure.
 */
import type { StoreData } from "./memory-store";
import { isValidTimeZone } from "./time";
import type { CustomDrink, Intake, LastReminder, Settings, Weekday } from "./types";

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

const isText = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isClock = (x: unknown): x is string => typeof x === "string" && CLOCK.test(x);
const isInstant = (x: unknown): x is string => typeof x === "string" && !Number.isNaN(Date.parse(x));
const isWeekday = (x: unknown): x is Weekday => isNum(x) && Number.isInteger(x) && x >= 1 && x <= 7;
const asRecord = (x: unknown): Record<string, unknown> => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});

/** Every field is checked on its own; a bad one takes the fallback's value. */
export function sanitizeSettings(raw: unknown, fallback: Settings): Settings {
  const r = asRecord(raw);
  const s: Settings = { ...fallback, workDays: [...fallback.workDays], reminder: { ...fallback.reminder } };
  if (typeof r.timeZone === "string" && isValidTimeZone(r.timeZone)) s.timeZone = r.timeZone;
  if (Array.isArray(r.workDays)) {
    const days = [...new Set(r.workDays.filter(isWeekday))].sort((a, b) => a - b);
    if (days.length) s.workDays = days;
  }
  if (isClock(r.workStart)) s.workStart = r.workStart;
  if (isClock(r.workEnd)) s.workEnd = r.workEnd;
  if (isClock(r.cutoffTime)) s.cutoffTime = r.cutoffTime;
  const rem = asRecord(r.reminder);
  if (rem.mode === "gap" && isNum(rem.gapMinutes) && rem.gapMinutes >= 1) {
    s.reminder = { mode: "gap", gapMinutes: Math.round(rem.gapMinutes) };
  } else if (rem.mode === "times" && Array.isArray(rem.times)) {
    const times = [...new Set(rem.times.filter(isClock))].sort();
    if (times.length) s.reminder = { mode: "times", times };
  }
  if (isNum(r.dailyLimitMg) && r.dailyLimitMg > 0) s.dailyLimitMg = r.dailyLimitMg;
  if (r.theme === "system" || r.theme === "light" || r.theme === "dark") s.theme = r.theme;
  if (typeof r.historyCollapsed === "boolean") s.historyCollapsed = r.historyCollapsed;
  return s;
}

/** Null when the entry can't be used. `takenAt` is normalised to UTC ISO so string comparison works. */
export function sanitizeIntake(raw: unknown): Intake | null {
  const r = asRecord(raw);
  if (!isText(r.id) || !isText(r.name) || !isNum(r.mg) || r.mg < 0 || !isInstant(r.takenAt)) return null;
  const intake: Intake = { id: r.id, name: r.name, mg: r.mg, takenAt: new Date(r.takenAt).toISOString() };
  if (isText(r.drinkId)) intake.drinkId = r.drinkId;
  return intake;
}

export function sanitizeCustomDrink(raw: unknown): CustomDrink | null {
  const r = asRecord(raw);
  if (!isText(r.id) || !isText(r.name) || !isNum(r.mg) || r.mg <= 0) return null;
  const drink: CustomDrink = { id: r.id, name: r.name, mg: r.mg };
  if (isText(r.serving)) drink.serving = r.serving;
  return drink;
}

export function sanitizeLastReminder(raw: unknown): LastReminder | null {
  const r = asRecord(raw);
  if (!isInstant(r.at) || !isText(r.slot)) return null;
  return { at: new Date(r.at).toISOString(), slot: r.slot };
}

/** Keeps the first entry for each id, dropping any that fail `check`. */
function sanitizeList<T extends { id: string }>(raw: unknown, check: (x: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of raw) {
    const ok = check(item);
    if (!ok || seen.has(ok.id)) continue;
    seen.add(ok.id);
    out.push(ok);
  }
  return out;
}

/** The whole data set, as a store should hold it. `fallback` fills in bad or missing settings. */
export function sanitizeStoreData(raw: unknown, fallback: Settings): StoreData {
  const r = asRecord(raw);
  return {
    settings: sanitizeSettings(r.settings, fallback),
    customDrinks: sanitizeList(r.customDrinks, sanitizeCustomDrink),
    intakes: sanitizeList(r.intakes, sanitizeIntake),
    lastReminder: sanitizeLastReminder(r.lastReminder),
  };
}
