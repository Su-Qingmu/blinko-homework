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

// 以下桩函数:Tauri 桌面端已删除,这些能力在 Web 模式下不可用
// 调用方应在调用前先用 isDesktop() / isInTauri() 检查
export async function downloadFromLink(_url: string, _filename?: string): Promise<void> {
  // Web 模式:用浏览器原生下载
  const a = document.createElement('a');
  a.href = _url;
  if (_filename) a.download = _filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function requestMicrophonePermission(): Promise<boolean> {
  // Web 模式:用浏览器 getUserMedia API
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export async function checkMicrophonePermission(): Promise<boolean> {
  // Web 模式:用 Permissions API 查询
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as any });
    return result.state === 'granted';
  } catch {
    return false;
  }
}