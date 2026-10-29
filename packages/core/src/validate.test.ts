import { DEFAULT_SETTINGS } from "./types";
import { sanitizeCustomDrink, sanitizeIntake, sanitizeLastReminder, sanitizeSettings, sanitizeStoreData } from "./validate";

const toronto = { ...DEFAULT_SETTINGS, timeZone: "America/Toronto" };

describe("sanitizeSettings", () => {
  it("keeps valid settings as they are", () => {
    const s = { ...toronto, workDays: [1, 3, 5] as const, reminder: { mode: "times" as const, times: ["10:00", "13:30"] }, theme: "dark" as const, historyCollapsed: true };
    expect(sanitizeSettings(s, DEFAULT_SETTINGS)).toEqual(s);
  });

  it("falls back field by field", () => {
    const s = sanitizeSettings(
      { timeZone: "Mars/Olympus", workDays: [0, 1, 1, 8, "2"], workStart: "9:00", workEnd: "25:00", cutoffTime: "14:30", dailyLimitMg: -5, theme: "neon", historyCollapsed: "yes" },
      toronto,
    );
    expect(s).toEqual({ ...toronto, workDays: [1], cutoffTime: "14:30" });
  });

  it("repairs the reminder setting", () => {
    expect(sanitizeSettings({ reminder: { mode: "gap", gapMinutes: 0 } }, toronto).reminder).toEqual(toronto.reminder);
    expect(sanitizeSettings({ reminder: { mode: "gap", gapMinutes: 90.4 } }, toronto).reminder).toEqual({ mode: "gap", gapMinutes: 90 });
    expect(sanitizeSettings({ reminder: { mode: "times", times: ["13:30", "x", "10:00", "13:30"] } }, toronto).reminder).toEqual({ mode: "times", times: ["10:00", "13:30"] });
    expect(sanitizeSettings({ reminder: { mode: "times", times: [] } }, toronto).reminder).toEqual(toronto.reminder);
    expect(sanitizeSettings({ reminder: "soon" }, toronto).reminder).toEqual(toronto.reminder);
  });

  it("never shares references with the fallback", () => {
    const s = sanitizeSettings(null, toronto);
    s.workDays.push(6);
    expect(toronto.workDays).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("sanitizeIntake and friends", () => {
  it("normalises the time to UTC ISO and keeps a drink id", () => {
    expect(sanitizeIntake({ id: "a", name: "Coffee", mg: 96, takenAt: "2026-10-29T09:00:00-04:00", drinkId: "coffee" })).toEqual({
      id: "a",
      name: "Coffee",
      mg: 96,
      takenAt: "2026-10-29T13:00:00.000Z",
      drinkId: "coffee",
    });
  });

  it("drops entries that cannot be used", () => {
    expect(sanitizeIntake({ id: "a", name: "Coffee", mg: "96", takenAt: "2026-10-29T13:00:00.000Z" })).toBeNull();
    expect(sanitizeIntake({ id: "a", name: "Coffee", mg: -1, takenAt: "2026-10-29T13:00:00.000Z" })).toBeNull();
    expect(sanitizeIntake({ id: "a", name: "Coffee", mg: 96, takenAt: "yesterday" })).toBeNull();
    expect(sanitizeIntake({ name: "Coffee", mg: 96, takenAt: "2026-10-29T13:00:00.000Z" })).toBeNull();
    expect(sanitizeIntake("coffee")).toBeNull();
    expect(sanitizeCustomDrink({ id: "d", name: "Decaf", mg: 0 })).toBeNull();
    expect(sanitizeCustomDrink({ id: "d", name: "Brew", mg: 120, serving: 473 })).toEqual({ id: "d", name: "Brew", mg: 120 });
    expect(sanitizeLastReminder({ at: "nope", slot: "x" })).toBeNull();
    expect(sanitizeLastReminder({ at: "2026-10-29T13:00:00.000Z", slot: 1 })).toBeNull();
  });
});

describe("sanitizeStoreData", () => {
  it("returns an empty data set for garbage", () => {
    expect(sanitizeStoreData("[]", toronto)).toEqual({ settings: toronto, customDrinks: [], intakes: [], lastReminder: null });
    expect(sanitizeStoreData(undefined, toronto)).toEqual({ settings: toronto, customDrinks: [], intakes: [], lastReminder: null });
  });

  it("keeps the first of two entries with the same id", () => {
    const d = sanitizeStoreData(
      {
        intakes: [
          { id: "a", name: "First", mg: 1, takenAt: "2026-10-29T13:00:00.000Z" },
          { id: "a", name: "Second", mg: 2, takenAt: "2026-10-29T13:00:00.000Z" },
        ],
        customDrinks: "none",
        lastReminder: { at: "2026-10-29T13:00:00Z", slot: "2026-10-29:gap:1" },
      },
      toronto,
    );
    expect(d.intakes.map((i) => i.name)).toEqual(["First"]);
    expect(d.customDrinks).toEqual([]);
    expect(d.lastReminder).toEqual({ at: "2026-10-29T13:00:00.000Z", slot: "2026-10-29:gap:1" });
  });
});
