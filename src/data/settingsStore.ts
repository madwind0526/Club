import type { AppSettings } from "../types/domain";

export const defaultSettings: AppSettings = {
  theme: "light",
  clubName: "Club Management",
  clubLogoPath: "",
  clubIntro: "동호회 소개를 Settings 화면에서 입력해 주세요.",
  dataRootFolder: "",
  photosFolder: "",
  receiptsFolder: "",
  expensesFolder: "",
  planFolder: "",
  memberImportFormat: "txt",
  memberImportMode: "append",
  memberImportFilePath: "",
  sponsorshipSingleAttendance: 5000,
  sponsorshipMultipleAttendance: 10000,
  reportClubName: ""
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

  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((body && typeof body === "object" && "error" in body && body.error) || "설정 저장에 실패했습니다.");
  }
}
