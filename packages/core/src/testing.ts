/**
 * Shared contract tests: every CaffeineStore implementation must pass these.
 * Import from "@caffeine/core/testing" inside a Vitest file and call
 * `storeContract("MyStore", () => new MyStore())`.
 */
import { describe, expect, it } from "vitest";
import type { CaffeineStore } from "./store";
import { DEFAULT_SETTINGS, type ExportFile } from "./types";

export function storeContract(name: string, make: () => CaffeineStore | Promise<CaffeineStore>): void {
  describe(`${name} (store contract)`, () => {
    it("starts with default settings and no data", async () => {
      const s = await make();
      expect(await s.getSettings()).toEqual(DEFAULT_SETTINGS);
      expect(await s.listIntakes("2000-01-01T00:00:00.000Z", "2100-01-01T00:00:00.000Z")).toEqual([]);
      expect(await s.listCustomDrinks()).toEqual([]);
      expect(await s.getLastReminder()).toBeNull();
    });

    it("saves and reads settings without sharing references", async () => {
      const s = await make();
      const next = { ...DEFAULT_SETTINGS, dailyLimitMg: 300, timeZone: "America/Toronto" };
      await s.saveSettings(next);
      const got = await s.getSettings();
      expect(got).toEqual(next);
      got.dailyLimitMg = 1;
      expect((await s.getSettings()).dailyLimitMg).toBe(300);
    });

    it("adds, lists, updates and removes intakes within a range", async () => {
      const s = await make();
      const a = await s.addIntake({ name: "Coffee", mg: 96, takenAt: "2026-10-29T13:00:00.000Z" });
      const b = await s.addIntake({ name: "Tea", mg: 47, takenAt: "2026-10-29T15:30:00.000Z" });
      await s.addIntake({ name: "Yesterday", mg: 10, takenAt: "2026-10-28T13:00:00.000Z" });
      expect(a.id).not.toBe(b.id);

      const day = await s.listIntakes("2026-10-29T00:00:00.000Z", "2026-10-30T00:00:00.000Z");
      expect(day.map((i) => i.name)).toEqual(["Coffee", "Tea"]);

      await s.updateIntake({ ...a, mg: 100 });
      expect((await s.listIntakes("2026-10-29T00:00:00.000Z", "2026-10-30T00:00:00.000Z"))[0]?.mg).toBe(100);

      await s.removeIntake(b.id);
      expect((await s.listIntakes("2026-10-29T00:00:00.000Z", "2026-10-30T00:00:00.000Z")).length).toBe(1);
    });

    it("rejects invalid intakes", async () => {
      const s = await make();
      await expect(s.addIntake({ name: "", mg: 10, takenAt: "2026-10-29T13:00:00.000Z" })).rejects.toMatchObject({ code: "invalid" });
      await expect(s.addIntake({ name: "x", mg: -1, takenAt: "2026-10-29T13:00:00.000Z" })).rejects.toMatchObject({ code: "invalid" });
    });

    it("saves custom drinks, newest first, and updates by id", async () => {
      const s = await make();
      const first = await s.saveCustomDrink({ name: "Office cold brew", mg: 200, serving: "473 ml" });
      await s.saveCustomDrink({ name: "Matcha", mg: 70 });
      expect((await s.listCustomDrinks()).map((d) => d.name)).toEqual(["Matcha", "Office cold brew"]);
      await s.saveCustomDrink({ ...first, mg: 180 });
      expect((await s.listCustomDrinks()).find((d) => d.id === first.id)?.mg).toBe(180);
      await s.removeCustomDrink(first.id);
      expect((await s.listCustomDrinks()).length).toBe(1);
    });

    it("keeps the last reminder", async () => {
      const s = await make();
      await s.setLastReminder({ at: "2026-10-29T14:00:00.000Z", slot: "2026-10-29:time:10:00" });
      expect(await s.getLastReminder()).toEqual({ at: "2026-10-29T14:00:00.000Z", slot: "2026-10-29:time:10:00" });
    });

    it("exports and imports a round trip", async () => {
      const s = await make();
      await s.saveSettings({ ...DEFAULT_SETTINGS, cutoffTime: "14:00" });
      await s.addIntake({ name: "Coffee", mg: 96, takenAt: "2026-10-29T13:00:00.000Z" });
      await s.saveCustomDrink({ name: "Yerba", mg: 85 });
      const file = await s.exportAll();
      expect(file.version).toBe(1);

      const t = await make();
      await t.importAll(file);
      expect((await t.getSettings()).cutoffTime).toBe("14:00");
      expect((await t.listIntakes("2000-01-01T00:00:00.000Z", "2100-01-01T00:00:00.000Z")).length).toBe(1);
      expect((await t.listCustomDrinks())[0]?.name).toBe("Yerba");
      await expect(t.importAll({} as never)).rejects.toMatchObject({ code: "invalid" });
    });

    it("repairs settings and drops malformed entries on import", async () => {
      const s = await make();
      await s.saveSettings({ ...DEFAULT_SETTINGS, timeZone: "America/Toronto" });
      const file = {
        version: 1,
        exportedAt: "2026-10-29T14:00:00.000Z",
        settings: { dailyLimitMg: -5, cutoffTime: "25:99", theme: "dark" },
        customDrinks: [
          { id: "a", name: "Good", mg: 50 },
          { id: "b", name: "", mg: 50 },
          { name: "no id", mg: 1 },
        ],
        intakes: [
          { id: "i1", name: "Coffee", mg: 96, takenAt: "2026-10-29T13:00:00Z" },
          { id: "i2", name: "Bad mg", mg: "lots", takenAt: "2026-10-29T13:00:00.000Z" },
          { id: "i3", name: "Bad date", mg: 1, takenAt: "yesterday" },
        ],
        lastReminder: { at: "nope", slot: 1 },
      } as unknown as ExportFile;
      await s.importAll(file);
      expect(await s.getSettings()).toEqual({ ...DEFAULT_SETTINGS, timeZone: "America/Toronto", theme: "dark" });
      const intakes = await s.listIntakes("2000-01-01T00:00:00.000Z", "2100-01-01T00:00:00.000Z");
      expect(intakes).toEqual([{ id: "i1", name: "Coffee", mg: 96, takenAt: "2026-10-29T13:00:00.000Z" }]);
      expect((await s.listCustomDrinks()).map((d) => d.name)).toEqual(["Good"]);
      expect(await s.getLastReminder()).toBeNull();
    });
  });
}
