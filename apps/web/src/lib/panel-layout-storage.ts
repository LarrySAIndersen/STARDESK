/** No-op Storage for SSR — useDefaultLayout must not touch real localStorage on the server. */
const SSR_PANEL_STORAGE: Storage = {
  get length() {
    return 0;
  },
  clear() {},
  getItem() {
    return null;
  },
  key() {
    return null;
  },
  removeItem() {},
  setItem() {},
};

/** Safe for useDefaultLayout during SSR and in the browser. */
export function getPanelLayoutStorage(): Storage {
  if (typeof window === "undefined") {
    return SSR_PANEL_STORAGE;
  }
  return window.localStorage;
}
