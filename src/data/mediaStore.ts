import type { DirectoryListing, MediaScanResult } from "../types/domain";

export async function pickFile(): Promise<{ path: string; name: string } | null> {
  if (window.clubApp?.pickFile) {
    return window.clubApp.pickFile();
  }

  // Browsers never expose an absolute path for security reasons, so the dev-only fallback
  // just records the file name - real path selection requires the Electron build.
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      const file = input.files?.[0];
      resolve(file ? { path: file.name, name: file.name } : null);
    };
    input.click();
  });
}

// Electron-only: browsers have no way to resolve a picked directory to a real filesystem path.
export async function pickFolder(defaultPath?: string): Promise<{ path: string } | null> {
  if (window.clubApp?.pickFolder) {
    return window.clubApp.pickFolder(defaultPath);
  }

  return null;
}

export async function scanMediaFolder(
  category: "Photos" | "Bank" | "Receipts" | "Expenses",
  yyyyMm: string,
  week: number
): Promise<MediaScanResult> {
  if (window.clubApp?.scanMediaFolder) {
    return window.clubApp.scanMediaFolder(category, yyyyMm, week);
  }

  const params = new URLSearchParams({ category, yyyyMm, week: String(week) });
  const response = await fetch(`/api/media-scan?${params.toString()}`);

  return response.ok ? response.json() : { folder: "", files: [] };
}

// Looks for every file under the Plan folder whose name starts with "<yyyyMm>-Week<week>"
// (e.g. "2026-07-Week3_계획서.pptx" and "2026-07-Week3_사진.jpg" both match), among common
// image/office document extensions.
export async function findPlanFiles(yyyyMm: string, week: number): Promise<Array<{ path: string; name: string }>> {
  if (window.clubApp?.findPlanFiles) {
    return window.clubApp.findPlanFiles(yyyyMm, week);
  }

  const params = new URLSearchParams({ yyyyMm, week: String(week) });
  const response = await fetch(`/api/plan-find?${params.toString()}`);

  return response.ok ? response.json() : [];
}

// Creates the Photos/Receipts/Expenses/<YYYY-MM>/Week<N> folders (and the Plan folder) under
// the configured media roots, so users don't have to create them manually before dropping files.
export async function ensureMediaFolders(yyyyMm: string, week: number): Promise<{ ok: boolean }> {
  if (window.clubApp?.ensureMediaFolders) {
    return window.clubApp.ensureMediaFolders(yyyyMm, week);
  }

  const response = await fetch("/api/media-ensure-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yyyyMm, week })
  });

  return response.ok ? response.json() : { ok: false };
}

// Backs the built-in folder navigator (월간 정리 Excel 내보내기 저장 폴더 선택). In the dev-only
// browser fallback (no Electron), /api/list-dir does the same fs.readdir/fs.stat listing on the
// same machine `npm run dev` runs on.
export async function listDirectory(dirPath?: string): Promise<DirectoryListing> {
  if (window.clubApp?.listDirectory) {
    return window.clubApp.listDirectory(dirPath);
  }

  const params = new URLSearchParams();

  if (dirPath) {
    params.set("path", dirPath);
  }

  const response = await fetch(`/api/list-dir${params.toString() ? `?${params.toString()}` : ""}`);

  return response.ok
    ? response.json()
    : { path: dirPath ?? "", parent: null, entries: [], shortcuts: [], error: "폴더를 불러오지 못했습니다." };
}

// Opens a file with the OS default application - used as the preview fallback for plan-file
// types that can't be rendered inline (doc/xls/ppt and their -x variants), and for the monthly
// Excel report's "열기" button. In the dev-only browser fallback, /api/open-path does the same
// open on the machine `npm run dev` runs on.
export async function openFileExternally(filePath: string): Promise<{ ok: boolean; error?: string }> {
  if (window.clubApp?.openPath) {
    return window.clubApp.openPath(filePath);
  }

  const response = await fetch("/api/open-path", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath })
  });
  const body = await response.json().catch(() => null);

  return response.ok ? (body ?? { ok: true }) : { ok: false, error: body?.error ?? "파일을 열지 못했습니다." };
}
