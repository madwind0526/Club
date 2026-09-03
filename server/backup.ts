import JSZip from "jszip";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveAppPath } from "./paths.js";

// Node-only module (no renderer imports) shared by electron/main.ts and vite.config.mts, mirroring
// server/excelExport.ts's pattern. Backs "DB 백업"/"DB 복원": one zip under <projectRoot>/backup/
// containing data/runtime/*.json (activities/members/board/settings), the whole configured
// data-root folder tree (Photos/Bank/Receipts/Expenses/Plan, wherever it currently points), and
// <projectRoot>/Report (월간 정리 Excel 내보내기 결과물 - same folder the file navigator's
// "프로젝트\Report 폴더" shortcut points at).
//
// Per-category folder overrides that point OUTSIDE the data-root folder are NOT included - only
// the unified root is backed up/restored.
//
// Uses JSZip rather than adm-zip - some corporate security policies block adm-zip specifically,
// and JSZip's plain-buffer, no-native-binding API sidesteps that entirely.

const RUNTIME_FILES = ["activities.json", "members.json", "board.json", "app-settings.json"];
const DATA_RUNTIME_PREFIX = "data/runtime/";
const DATA_ROOT_PREFIX = "data-root/";
const REPORT_PREFIX = "report/";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function backupFileName(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-DB backup.zip`;
}

async function readDataRootFolder(dataDir: string): Promise<string | null> {
  try {
    const raw = await readFile(path.join(dataDir, "app-settings.json"), "utf8");
    const settings = JSON.parse(raw) as { dataRootFolder?: string };

    return settings.dataRootFolder ? resolveAppPath(settings.dataRootFolder) : null;
  } catch {
    return null;
  }
}

// Recursively adds every file under `folderPath` to the zip, keyed as `<zipPrefix>/<relative
// path>` (always forward-slash, regardless of OS) - JSZip has no addLocalFolder equivalent, so
// the directory walk is done by hand.
async function addFolderToZip(zip: JSZip, folderPath: string, zipPrefix: string): Promise<void> {
  const entries = await readdir(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    const zipEntryName = `${zipPrefix}/${entry.name}`;

    if (entry.isDirectory()) {
      await addFolderToZip(zip, fullPath, zipEntryName);
    } else if (entry.isFile()) {
      zip.file(zipEntryName, await readFile(fullPath));
    }
  }
}

export async function createDatabaseBackup(
  dataDir: string,
  projectRoot: string
): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    const zip = new JSZip();

    for (const file of RUNTIME_FILES) {
      const filePath = path.join(dataDir, file);

      if (existsSync(filePath)) {
        zip.file(`${DATA_RUNTIME_PREFIX}${file}`, await readFile(filePath));
      }
    }

    const dataRootFolder = await readDataRootFolder(dataDir);

    if (dataRootFolder && existsSync(dataRootFolder)) {
      await addFolderToZip(zip, dataRootFolder, "data-root");
    }

    const reportFolder = path.join(projectRoot, "Report");

    if (existsSync(reportFolder)) {
      await addFolderToZip(zip, reportFolder, "report");
    }

    const backupDir = path.join(projectRoot, "backup");

    await mkdir(backupDir, { recursive: true });

    const zipPath = path.join(backupDir, backupFileName());
    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    await writeFile(zipPath, buffer);

    return { ok: true, path: zipPath };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "DB 백업에 실패했습니다." };
  }
}

export async function listDatabaseBackups(
  projectRoot: string
): Promise<Array<{ name: string; size: number; modifiedAt: string }>> {
  const backupDir = path.join(projectRoot, "backup");

  try {
    const entries = await readdir(backupDir, { withFileTypes: true });
    const zipFiles = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip"));

    const results = await Promise.all(
      zipFiles.map(async (entry) => {
        const filePath = path.join(backupDir, entry.name);
        const info = await stat(filePath);

        return { name: entry.name, size: info.size, modifiedAt: info.mtime.toISOString() };
      })
    );

    return results.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  } catch {
    return [];
  }
}

// Deletes the CURRENT data/runtime/*.json files and the CURRENT data-root folder, then extracts
// the chosen backup's contents back into those same (current) locations. "Current" is read from
// app-settings.json BEFORE it gets deleted, so a restore always lands wherever this app instance
// is presently configured to look, not wherever the backup was originally taken from.
export async function restoreDatabaseBackup(
  dataDir: string,
  projectRoot: string,
  backupFile: string
): Promise<{ ok: boolean; error?: string }> {
  // Backup filenames are only ever chosen from listDatabaseBackups' own output on the client -
  // still reject anything that isn't a plain filename, so a crafted name can't escape the backup
  // folder via a path traversal.
  if (!backupFile || /[\\/]/.test(backupFile) || backupFile.includes("..")) {
    return { ok: false, error: "잘못된 백업 파일입니다." };
  }

  const zipPath = path.join(projectRoot, "backup", backupFile);

  if (!existsSync(zipPath)) {
    return { ok: false, error: "백업 파일을 찾을 수 없습니다." };
  }

  const dataRootFolder = await readDataRootFolder(dataDir);
  const reportFolder = path.join(projectRoot, "Report");

  try {
    const zip = await JSZip.loadAsync(await readFile(zipPath));

    for (const file of RUNTIME_FILES) {
      await rm(path.join(dataDir, file), { force: true });
    }

    if (dataRootFolder && existsSync(dataRootFolder)) {
      await rm(dataRootFolder, { recursive: true, force: true });
    }

    if (existsSync(reportFolder)) {
      await rm(reportFolder, { recursive: true, force: true });
    }

    await mkdir(dataDir, { recursive: true });

    for (const entry of Object.values(zip.files)) {
      if (entry.dir) {
        continue;
      }

      let targetPath: string | null = null;

      if (entry.name.startsWith(DATA_RUNTIME_PREFIX)) {
        targetPath = path.join(dataDir, entry.name.slice(DATA_RUNTIME_PREFIX.length));
      } else if (dataRootFolder && entry.name.startsWith(DATA_ROOT_PREFIX)) {
        targetPath = path.join(dataRootFolder, entry.name.slice(DATA_ROOT_PREFIX.length));
      } else if (entry.name.startsWith(REPORT_PREFIX)) {
        targetPath = path.join(reportFolder, entry.name.slice(REPORT_PREFIX.length));
      }

      if (!targetPath) {
        continue;
      }

      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, await entry.async("nodebuffer"));
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "DB 복원에 실패했습니다." };
  }
}
