import type { DatabaseBackupInfo } from "../types/domain";

export async function backupDatabase(): Promise<{ ok: boolean; path?: string; error?: string }> {
  if (window.clubApp?.backupDatabase) {
    return window.clubApp.backupDatabase();
  }

  const response = await fetch("/api/db/backup", { method: "POST" });
  const body = await response.json().catch(() => null);

  return response.ok ? (body ?? { ok: true }) : { ok: false, error: body?.error ?? "DB 백업에 실패했습니다." };
}

export async function listDatabaseBackups(): Promise<DatabaseBackupInfo[]> {
  if (window.clubApp?.listDatabaseBackups) {
    return window.clubApp.listDatabaseBackups();
  }

  const response = await fetch("/api/db/list-backups");

  return response.ok ? response.json() : [];
}

export async function restoreDatabaseBackup(fileName: string): Promise<{ ok: boolean; error?: string }> {
  if (window.clubApp?.restoreDatabase) {
    return window.clubApp.restoreDatabase(fileName);
  }

  const response = await fetch("/api/db/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName })
  });
  const body = await response.json().catch(() => null);

  return response.ok ? (body ?? { ok: true }) : { ok: false, error: body?.error ?? "DB 복원에 실패했습니다." };
}
