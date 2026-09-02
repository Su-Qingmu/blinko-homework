// Tauri stub for web-only build (simplified course project)
// Tauri desktop integration was removed. All capability checks return false
// and desktop-only side effects are no-ops.

export const isAndroid = (): boolean => false;
export const isInTauri = (): boolean => false;
export const isDesktop = (): boolean => false;
export const isMobile = (): boolean => false;

export async function setTauriTheme(_theme: 'light' | 'dark'): Promise<void> {
  // No-op in web build
}