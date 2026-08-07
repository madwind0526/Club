import type { MediaScanResult } from "../types/domain";

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

export async function scanMediaFolder(
  category: "Photos" | "Receipts" | "Expenses",
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

// Looks for a file under <dataRootFolder>/Plan/ whose name starts with "<yyyyMm>-Week<week>"
// (e.g. "2026-07-Week3_계획서.pptx"), among common image/office document extensions.
export async function findPlanFile(yyyyMm: string, week: number): Promise<{ path: string; name: string } | null> {
  if (window.clubApp?.findPlanFile) {
    return window.clubApp.findPlanFile(yyyyMm, week);
  }

  const params = new URLSearchParams({ yyyyMm, week: String(week) });
  const response = await fetch(`/api/plan-find?${params.toString()}`);

  return response.ok ? response.json() : null;
}

// Opens a file with the OS default application - used as the preview fallback for plan-file
// types that can't be rendered inline (doc/xls/ppt and their -x variants). Electron-only.
export async function openFileExternally(filePath: string): Promise<{ ok: boolean; error?: string }> {
  if (window.clubApp?.openPath) {
    return window.clubApp.openPath(filePath);
  }

  return { ok: false, error: "Electron 앱에서만 파일을 열 수 있습니다." };
}
