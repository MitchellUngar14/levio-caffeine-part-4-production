import { type CaffeineStore, InMemoryStore, defaultSettings, isValidTimeZone } from "@caffeine/core";
import { LocalStorageStore } from "./local-storage-store";

/** The one place that picks a store. Set VITE_STORE=memory for a throwaway session. */
export function createStore(): CaffeineStore {
  const kind = import.meta.env.VITE_STORE ?? "local";
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tz = isValidTimeZone(browserTz) ? browserTz : "UTC";
  if (kind === "memory") return new InMemoryStore({ settings: defaultSettings(tz) });
  try {
    // Reading window.localStorage itself throws when the browser blocks site data.
    return new LocalStorageStore(window.localStorage, tz);
  } catch {
    console.warn("caffeine_tracker: browser storage is blocked, so nothing will be saved this session");
    return new InMemoryStore({ settings: defaultSettings(tz) });
  }
}
