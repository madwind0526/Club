import type { Activity } from "../types/domain";

export async function listActivities(): Promise<Activity[]> {
  if (window.clubApp?.listActivities) {
    return window.clubApp.listActivities();
  }

  const response = await fetch("/api/activities");
  return response.ok ? response.json() : [];
}

export async function saveActivities(activities: Activity[]): Promise<Activity[]> {
  if (window.clubApp?.saveActivities) {
    return window.clubApp.saveActivities(activities);
  }

  const response = await fetch("/api/activities", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(activities)
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error((body && typeof body === "object" && "error" in body && body.error) || "활동 데이터를 저장하지 못했습니다.");
  }

  return body as Activity[];
}

// Week-of-month counted from the first day of the activity's month (1-indexed).
export function computeWeekOfMonth(dateIso: string): number {
  const date = new Date(`${dateIso}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return 1;
  }

  return Math.ceil(date.getDate() / 7);
}

export function formatYyyyMm(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function formatYyMm(dateIso: string): string {
  return dateIso.slice(2, 7);
}

export function formatLocalDateIso(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export type ActivityStatus = "완료" | "예정";

// An activity dated today counts as completed - it is either already underway or over by the
// time anyone is looking at the report screen for it.
export function getActivityStatus(dateIso: string, today = new Date()): ActivityStatus {
  const todayIso = formatLocalDateIso(today);
  return dateIso <= todayIso ? "완료" : "예정";
}

// `folderPath` (chosen via the built-in FolderNavigatorModal, both in Electron and the dev-only
// browser fallback) is where the file gets saved - in the browser case, /api/export-monthly-excel
// writes it server-side, on the same machine `npm run dev` runs on, the same way electron/main.ts
// does, rather than streaming a browser download.
export async function exportMonthlyReportExcel(
  yyyyMm: string,
  folderPath: string
): Promise<{ ok: boolean; path?: string; error?: string }> {
  if (window.clubApp?.exportMonthlyExcel) {
    try {
      return await window.clubApp.exportMonthlyExcel(yyyyMm, folderPath);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "엑셀 파일 생성에 실패했습니다." };
    }
  }

  const params = new URLSearchParams({ yyyyMm, folder: folderPath });
  const response = await fetch(`/api/export-monthly-excel?${params.toString()}`);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return { ok: false, error: body?.error ?? "엑셀 파일 생성에 실패했습니다." };
  }

  return body ?? { ok: true };
}
