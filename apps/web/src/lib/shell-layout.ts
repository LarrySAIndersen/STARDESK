/** localStorage id passed to useDefaultLayout (stored as react-resizable-panels:stardesk-shell-widths). */
export const SHELL_WIDTHS_STORAGE_KEY = "stardesk-shell-widths";

/** Portal sub-nav column widths inside main content. */
export const PORTAL_SHELL_WIDTHS_STORAGE_KEY = "stardesk-portal-shell-widths";

export const SHELL_PANEL_NAV = "nav";
export const SHELL_PANEL_MAIN = "main";
export const PORTAL_PANEL_NAV = "portal-nav";
export const PORTAL_PANEL_MAIN = "portal-main";

export const SHELL_NAV = { default: 210, min: 160, max: 280 } as const;
export const PORTAL_NAV = { default: 200, min: 160, max: 280 } as const;
