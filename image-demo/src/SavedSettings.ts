
/** App settings saved persistently in local storage */
export interface SavedSettings {
  performanceLog?: boolean;
  helpSeen?: boolean;
}

const settingsKey = "savedSettings";

let settings: SavedSettings = fetchSettings();

/** current persistent app settings */
export function savedSettings(): SavedSettings {
  return settings;
}


/** update persistent app settings */
export function updateSavedSettings(s: Partial<SavedSettings>): void {
  const combinedSettings = { ...settings, ...s };
  window.localStorage.setItem(settingsKey, JSON.stringify(combinedSettings));
  settings = combinedSettings;
}

function fetchSettings(): SavedSettings {
  const found = window.localStorage.getItem(settingsKey);
  if (found) {
    return JSON.parse(found);
  } else {
    window.localStorage.setItem(settingsKey, "{}");
    return {};
  }
}