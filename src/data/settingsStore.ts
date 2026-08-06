import type { AppSettings } from "../types/domain";

export const defaultSettings: AppSettings = {
  theme: "light",
  clubName: "Club Management",
  clubLogoPath: "",
  clubIntro: "동호회 소개를 Settings 화면에서 입력해 주세요.",
  dataRootFolder: ""
};

export async function loadSettings(): Promise<AppSettings> {
  const viaIpc = await window.clubApp?.loadSettings?.();

  if (viaIpc) {
    return { ...defaultSettings, ...viaIpc };
  }

  const response = await fetch("/api/settings").catch(() => null);
  const parsed = response?.ok ? ((await response.json()) as Partial<AppSettings> | null) : null;

  return { ...defaultSettings, ...(parsed ?? {}) };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (window.clubApp?.saveSettings) {
    await window.clubApp.saveSettings(settings);
    return;
  }

  await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings)
  });
}
