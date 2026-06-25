export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_SETTING_KEY = 'color_scheme';

export const LIGHT_PLACEHOLDER = '#6B7280';
export const DARK_PLACEHOLDER = '#9CA3AF';

export function normalizeThemePreference(value: string | null): ThemePreference {
  return value === 'dark' || value === 'system' ? value : 'light';
}
