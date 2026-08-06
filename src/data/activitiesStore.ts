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

  return response.json();
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
