import { type CaffeineStore, StoreError, isExportFile, newId } from "./store";
import { DEFAULT_SETTINGS, type CustomDrink, type ExportFile, type Intake, type LastReminder, type NewCustomDrink, type NewIntake, type Settings } from "./types";
import { sanitizeStoreData } from "./validate";

export interface StoreData {
  settings: Settings;
  customDrinks: CustomDrink[];
  intakes: Intake[];
  lastReminder: LastReminder | null;
}

export function emptyData(settings: Settings = DEFAULT_SETTINGS): StoreData {
  return { settings: { ...settings }, customDrinks: [], intakes: [], lastReminder: null };
}

/**
 * Stores everything in one in-memory object. Used by tests, and extended by
 * stores that persist the same object somewhere (LocalStorageStore).
 */
export class InMemoryStore implements CaffeineStore {
  protected data: StoreData;

  constructor(initial?: Partial<StoreData>) {
    this.data = { ...emptyData(), ...initial };
  }

  /** Subclasses persist here. Called after every change. */
  protected async persist(): Promise<void> {}

  async getSettings(): Promise<Settings> {
    return { ...this.data.settings };
  }

  async saveSettings(s: Settings): Promise<void> {
    this.data.settings = { ...s };
    await this.persist();
  }

  async listIntakes(from: string, to: string): Promise<Intake[]> {
    return this.data.intakes
      .filter((i) => i.takenAt >= from && i.takenAt < to)
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
      .map((i) => ({ ...i }));
  }

  async addIntake(i: NewIntake): Promise<Intake> {
    if (!(i.mg >= 0) || !i.name.trim() || Number.isNaN(Date.parse(i.takenAt))) throw new StoreError("invalid");
    const intake: Intake = { ...i, id: newId() };
    this.data.intakes.push(intake);
    await this.persist();
    return { ...intake };
  }

  async updateIntake(i: Intake): Promise<void> {
    const idx = this.data.intakes.findIndex((x) => x.id === i.id);
    if (idx < 0) throw new StoreError("conflict", "intake not found");
    this.data.intakes[idx] = { ...i };
    await this.persist();
  }

  async removeIntake(id: string): Promise<void> {
    this.data.intakes = this.data.intakes.filter((x) => x.id !== id);
    await this.persist();
  }

  async listCustomDrinks(): Promise<CustomDrink[]> {
    return this.data.customDrinks.map((d) => ({ ...d }));
  }

  async saveCustomDrink(d: NewCustomDrink | CustomDrink): Promise<CustomDrink> {
    if (!(d.mg > 0) || !d.name.trim()) throw new StoreError("invalid");
    const drink: CustomDrink = { ...d, id: "id" in d && d.id ? d.id : newId() };
    const idx = this.data.customDrinks.findIndex((x) => x.id === drink.id);
    if (idx >= 0) this.data.customDrinks[idx] = drink;
    else this.data.customDrinks.unshift(drink);
    await this.persist();
    return { ...drink };
  }

  async removeCustomDrink(id: string): Promise<void> {
    this.data.customDrinks = this.data.customDrinks.filter((x) => x.id !== id);
    await this.persist();
  }

  async getLastReminder(): Promise<LastReminder | null> {
    return this.data.lastReminder ? { ...this.data.lastReminder } : null;
  }

  async setLastReminder(r: LastReminder): Promise<void> {
    this.data.lastReminder = { ...r };
    await this.persist();
  }

  async exportAll(): Promise<ExportFile> {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...this.data.settings },
      customDrinks: this.data.customDrinks.map((d) => ({ ...d })),
      intakes: this.data.intakes.map((i) => ({ ...i })),
      lastReminder: this.data.lastReminder ? { ...this.data.lastReminder } : null,
    };
  }

  async importAll(f: ExportFile): Promise<void> {
    if (!isExportFile(f)) throw new StoreError("invalid", "not a caffeine tracker export");
    // The file came from outside the app: repair settings and drop entries that can't be used.
    // Settings the file lacks keep their current value (for example the time zone).
    this.data = sanitizeStoreData(f, this.data.settings);
    await this.persist();
  }
}
