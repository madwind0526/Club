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

export type ActivityStatus = "완료" | "예정";

// An activity dated today counts as completed - it is either already underway or over by the
// time anyone is looking at the report screen for it.
export function getActivityStatus(dateIso: string, today = new Date()): ActivityStatus {
  const todayIso = today.toISOString().slice(0, 10);
  return dateIso <= todayIso ? "완료" : "예정";
}

// In Electron this opens a native "Save As" dialog. In the dev-only browser fallback, the
// generated workbook streams back as a normal file download instead.
export async function exportMonthlyReportExcel(yyyyMm: string): Promise<{ ok: boolean; path?: string; error?: string }> {
  if (window.clubApp?.exportMonthlyExcel) {
    try {
      return await window.clubApp.exportMonthlyExcel(yyyyMm);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "엑셀 파일 생성에 실패했습니다." };
    }
  }

  const response = await fetch(`/api/export-monthly-excel?yyyyMm=${encodeURIComponent(yyyyMm)}`);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      const body = await response.json().catch(() => null);
      return { ok: false, error: body?.error ?? "권한이 없습니다." };
    }

    return { ok: false, error: "엑셀 파일 생성에 실패했습니다." };
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `club-management-${yyyyMm}-monthly-report.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);

  return { ok: true };
}
