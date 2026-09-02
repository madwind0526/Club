import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from "electron";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildMonthlyReportWorkbook } from "../server/excelExport.js";
import { createDatabaseBackup, listDatabaseBackups, restoreDatabaseBackup } from "../server/backup.js";
import { resolveAppPath, resolveCategoryFolder, resolvePlanFolder } from "../server/paths.js";
import {
  isActivityListStructuralChange,
  isBoardEditBeyondMemberPermissions,
  isBoardPostListForPermissionCheck,
  isEditBeyondSelfAttendanceToggle,
  sanitizeSelfMemberEdit
} from "../server/auth.js";

// The renderer is loaded from an http(s) origin (Vite dev server / packaged app origin), and
// Chromium refuses to load file:// as a subresource from a non-file:// page. Local files (club
// logo, activity photos/receipts/expenses) are served through this custom protocol instead - the
// encoding here must match `toDisplayableFileUrl` in src/utils/fileUrl.ts.
const CLUB_MEDIA_SCHEME = "club-media";

protocol.registerSchemesAsPrivileged([
  {
    scheme: CLUB_MEDIA_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  }
]);

function toClubMediaUrl(filePath: string) {
  return `${CLUB_MEDIA_SCHEME}://local/${encodeURIComponent(filePath)}`;
}

interface StoredMember {
  id: string;
  name: string;
  knoxId: string;
  passwordHash: string;
  department: string;
  contact: string;
  joinDate: string;
  grade: string;
  role: string;
  note?: string;
  withdrawn: boolean;
}

interface BoardPostForAuthCheck {
  id: string;
  category: unknown;
  title: unknown;
  content: unknown;
  authorId: string;
  createdAt: unknown;
  pinned: unknown;
  comments: Array<{
    id: string;
    authorId: string;
    content: unknown;
    createdAt: unknown;
    parentCommentId?: string;
  }>;
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);
const PLAN_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".gif",
  ".png",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".pdf"
]);

const dataDir = path.resolve(process.cwd(), process.env.CLUB_DATA_DIR ?? "data/runtime");
const projectRoot = process.cwd();

function dataFilePath(name: string) {
  return path.join(dataDir, name);
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(dataFilePath(name), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(name: string, data: unknown) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFilePath(name), JSON.stringify(data, null, 2), "utf8");
}

function hashPassword(password: string) {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

function toPublicMember(member: StoredMember) {
  const { passwordHash, ...rest } = member;
  return rest;
}

// The renderer is a single logged-in user at a time, so a module-level variable is enough to
// track "who's currently logged in" for authorizing IPC calls - this guards against a compromised
// or dev-tools-driven renderer script calling window.clubApp directly, bypassing the React UI's
// own role checks. Kept in sync with the same-shaped session cookie in vite.config.mts.
let currentSessionMemberId: string | null = null;

async function getSessionMember(): Promise<StoredMember | null> {
  if (!currentSessionMemberId) {
    return null;
  }

  const members = await readJson<StoredMember[]>("members.json", []);
  const member = members.find((candidate) => candidate.id === currentSessionMemberId);

  if (!member || member.withdrawn) {
    currentSessionMemberId = null;
    return null;
  }

  return member;
}

async function requireMember(): Promise<StoredMember> {
  const member = await getSessionMember();

  if (!member) {
    throw new Error("로그인이 필요합니다.");
  }

  return member;
}

async function requireAdmin(): Promise<StoredMember> {
  const member = await requireMember();

  if (member.role !== "admin") {
    throw new Error("권한이 없습니다. admin만 접근할 수 있습니다.");
  }

  return member;
}

async function seedInitialAdmin() {
  const members = await readJson<StoredMember[]>("members.json", []);

  if (members.length > 0) {
    return;
  }

  const seedAdmin: StoredMember = {
    id: "member-admin-seed",
    name: "관리자",
    knoxId: "admin",
    passwordHash: hashPassword("admin1234"),
    department: "운영진",
    contact: "",
    joinDate: new Date().toISOString().slice(0, 10),
    grade: "회장",
    role: "admin",
    note: "초기 관리자 계정 (Settings에서 회원 정보 수정 권장)",
    withdrawn: false
  };

  await writeJson("members.json", [seedAdmin]);
}

ipcMain.handle("settings:load", () => readJson("app-settings.json", null));

ipcMain.handle("settings:save", async (_event, settings: unknown) => {
  await requireAdmin();
  await writeJson("app-settings.json", settings);
  return true;
});

ipcMain.handle("members:list", async () => {
  await requireMember();
  const members = await readJson<StoredMember[]>("members.json", []);
  return members.map(toPublicMember);
});

ipcMain.handle(
  "members:add",
  async (_event, input: Omit<StoredMember, "id" | "passwordHash" | "withdrawn"> & { password: string }) => {
    await requireAdmin();
    const members = await readJson<StoredMember[]>("members.json", []);
    const { password, ...rest } = input;
    const member: StoredMember = {
      ...rest,
      id: `member-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      passwordHash: hashPassword(password || rest.knoxId),
      withdrawn: false
    };

    members.push(member);
    await writeJson("members.json", members);
    return members.map(toPublicMember);
  }
);

ipcMain.handle(
  "members:update",
  async (_event, input: Omit<StoredMember, "passwordHash" | "withdrawn"> & { newPassword?: string }) => {
    const requester = await requireMember();
    const { newPassword, ...rest } = input;

    if (requester.role !== "admin" && rest.id !== requester.id) {
      throw new Error("권한이 없습니다. 본인 정보만 수정할 수 있습니다.");
    }

    const members = await readJson<StoredMember[]>("members.json", []);
    const existing = members.find((member) => member.id === rest.id);

    if (!existing) {
      throw new Error("회원을 찾을 수 없습니다.");
    }

    const safeRest = requester.role === "admin" ? rest : sanitizeSelfMemberEdit(existing, rest);
    const nextMembers = members.map((member) =>
      member.id === safeRest.id
        ? { ...member, ...safeRest, ...(newPassword ? { passwordHash: hashPassword(newPassword) } : {}) }
        : member
    );

    await writeJson("members.json", nextMembers);
    return nextMembers.map(toPublicMember);
  }
);

// Soft delete: a completed activity's attendeeIds still needs to resolve to a real name/note
// afterward, so 삭제 marks the member withdrawn instead of erasing the record. MembersView hides
// withdrawn members from the roster; attendee tables elsewhere still resolve their name and flag
// them "탈퇴" in the 비고 column.
ipcMain.handle("members:remove", async (_event, id: string) => {
  await requireAdmin();
  const members = await readJson<StoredMember[]>("members.json", []);
  const nextMembers = members.map((member) => (member.id === id ? { ...member, withdrawn: true } : member));

  await writeJson("members.json", nextMembers);
  return nextMembers.map(toPublicMember);
});

ipcMain.handle(
  "members:import",
  async (
    _event,
    rows: Array<Omit<StoredMember, "id" | "passwordHash" | "withdrawn">>,
    mode: "append" | "replace" = "append",
    initialPassword?: string
  ) => {
    await requireAdmin();
    const existing = mode === "replace" ? [] : await readJson<StoredMember[]>("members.json", []);
    // Skip rows whose Knox ID already exists (in the current roster, or earlier in this same
    // batch) - Knox ID is how login and every other lookup identifies a member.
    const seenKnoxIds = new Set(existing.map((member) => member.knoxId));
    const imported: StoredMember[] = [];

    rows.forEach((row, index) => {
      if (seenKnoxIds.has(row.knoxId)) {
        return;
      }

      seenKnoxIds.add(row.knoxId);
      imported.push({
        ...row,
        id: `member-${Date.now()}-${index}-${Math.round(Math.random() * 1000)}`,
        // A shared initial password applies to every imported row (admin included) when set;
        // otherwise each row falls back to its own Knox ID, as before.
        passwordHash: hashPassword(initialPassword || row.knoxId),
        withdrawn: false
      });
    });

    const merged = [...existing, ...imported];

    await writeJson("members.json", merged);
    return merged.map(toPublicMember);
  }
);

ipcMain.handle("assets:readMembersFile", async (_event, format: "json" | "txt") => {
  await requireAdmin();
  const settings = await readJson<{ memberImportFilePath?: string } | null>("app-settings.json", null);
  const fileName = format === "json" ? "members.json" : "members.txt";
  const filePath = settings?.memberImportFilePath
    ? resolveAppPath(settings.memberImportFilePath)
    : path.join(process.cwd(), "assets", fileName);

  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
});

ipcMain.handle("auth:login", async (_event, knoxId: string, password: string) => {
  const members = await readJson<StoredMember[]>("members.json", []);
  const found = members.find((member) => member.knoxId === knoxId);

  if (!found || found.passwordHash !== hashPassword(password)) {
    return { ok: false, error: "Knox ID 또는 비밀번호가 올바르지 않습니다." };
  }

  if (found.withdrawn) {
    return { ok: false, error: "탈퇴한 회원입니다." };
  }

  currentSessionMemberId = found.id;
  return { ok: true, member: toPublicMember(found) };
});

ipcMain.handle("auth:logout", () => {
  currentSessionMemberId = null;
  return { ok: true };
});

ipcMain.handle("auth:session", async () => {
  const member = await getSessionMember();
  return member ? { ok: true, member: toPublicMember(member) } : { ok: false };
});

ipcMain.handle("shell:openPath", async (_event, filePath: string) => {
  await requireMember();
  const settings = await readJson<FolderSettings | null>("app-settings.json", null);
  const resolvedPath = resolveAppPath(filePath);

  if (!isAllowedLocalFilePath(resolvedPath, settings) && !isMonthlyExcelReportPath(resolvedPath)) {
    return { ok: false, error: "열 수 없는 파일 경로입니다." };
  }

  const result = await shell.openPath(resolvedPath);

  return result === "" ? { ok: true } : { ok: false, error: result };
});

// The destination folder comes from the built-in file navigator (src/components/views/
// FolderNavigatorModal.tsx), not a native dialog - see fs:listDir below for why. The filename
// itself is never user-editable, so it's built here the same way the old save-dialog's
// `defaultPath` did.
ipcMain.handle("export:monthlyExcel", async (_event, yyyyMm: string, folderPath: string) => {
  await requireAdmin();

  const resolvedFolder = resolveAppPath(folderPath);

  try {
    const folderStat = await stat(resolvedFolder);

    if (!folderStat.isDirectory()) {
      return { ok: false, error: "선택한 경로가 폴더가 아닙니다." };
    }
  } catch {
    return { ok: false, error: "선택한 폴더를 찾을 수 없습니다." };
  }

  const filePath = path.join(resolvedFolder, `club-management-${yyyyMm}-monthly-report.xlsx`);

  try {
    const workbook = await buildMonthlyReportWorkbook(dataDir, yyyyMm);

    await workbook.xlsx.writeFile(filePath);
    // Fire-and-forget - a monthly export is a natural "things are in a good state" checkpoint,
    // so back up the DB automatically, but never let a backup failure affect the export's own
    // result.
    void createDatabaseBackup(dataDir, projectRoot);
    return { ok: true, path: filePath };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "엑셀 파일 생성에 실패했습니다." };
  }
});

ipcMain.handle("db:backup", async () => {
  await requireAdmin();
  return createDatabaseBackup(dataDir, projectRoot);
});

ipcMain.handle("db:listBackups", async () => {
  await requireAdmin();
  return listDatabaseBackups(projectRoot);
});

ipcMain.handle("db:restore", async (_event, fileName: string) => {
  await requireAdmin();
  return restoreDatabaseBackup(dataDir, projectRoot, fileName);
});

// bankFileNames was added after activities.json already had real data on disk - default it to []
// for any activity saved before that, so opening an older activity's report doesn't crash on a
// missing array (MediaSection reads `files.length`/`files.map` unconditionally).
function withBankFileNamesDefault(activity: Record<string, unknown>) {
  return { ...activity, bankFileNames: (activity.bankFileNames as string[] | undefined) ?? [] };
}

ipcMain.handle("activities:list", async () => {
  await requireMember();
  const activities = await readJson<Array<Record<string, unknown>>>("activities.json", []);
  return activities.map(withBankFileNamesDefault);
});

interface ActivityForAuthCheck {
  id: string;
  title: unknown;
  content: unknown;
  date: unknown;
  weekOfMonth: unknown;
  planFilePaths: unknown;
  attendeeIds: string[];
  photoFileNames: unknown;
  bankFileNames: unknown;
  receiptFileNames: unknown;
  expenseFileNames: unknown;
  receipts: unknown;
  expenses: unknown;
}

ipcMain.handle("activities:save", async (_event, activities: ActivityForAuthCheck[]) => {
  const requester = await requireMember();
  // Normalized the same way as activities:list - otherwise an activity saved before
  // bankFileNames existed would look, to the permission check below, like the incoming request
  // just changed it (stored value undefined vs. the client's now-normalized []), wrongly
  // blocking a plain attendance toggle on it.
  const current = (await readJson<ActivityForAuthCheck[]>("activities.json", [])).map((activity) => ({
    ...activity,
    bankFileNames: (activity.bankFileNames as string[] | undefined) ?? []
  }));

  if (requester.role !== "admin") {
    // 활동 등록/삭제(구조적 변경)는 admin만. 이미 있는 활동에 대해서도 일반 회원이 바꿀 수 있는 건
    // 본인 참석 여부 하나뿐 - 나머지(제목/내용/계획서/사진/영수증/경비, 다른 사람 참석 여부)는
    // 전부 admin만 수정 가능하다 (열람은 그대로 가능).
    if (isActivityListStructuralChange(current, activities)) {
      throw new Error("권한이 없습니다. admin만 활동을 등록/삭제할 수 있습니다.");
    }

    if (isEditBeyondSelfAttendanceToggle(current, activities, requester.id)) {
      throw new Error("권한이 없습니다. 본인 참석 여부 외의 항목은 admin만 수정할 수 있습니다.");
    }
  }

  await writeJson("activities.json", activities);
  return activities;
});

ipcMain.handle("board:list", async () => {
  await requireMember();
  return readJson("board.json", []);
});

ipcMain.handle("board:save", async (_event, posts: unknown) => {
  const requester = await requireMember();
  const current = await readJson<BoardPostForAuthCheck[]>("board.json", []);

  if (!isBoardPostListForPermissionCheck(posts)) {
    throw new Error("게시글 데이터 형식이 올바르지 않습니다.");
  }

  if (requester.role !== "admin" && isBoardEditBeyondMemberPermissions(current, posts, requester.id)) {
    throw new Error("권한이 없습니다. 본인 게시글 삭제와 댓글 작성만 가능합니다.");
  }

  await writeJson("board.json", posts);
  return posts;
});

// Without a parent window, showOpenDialog can open without stealing focus from the app window -
// it's technically there, but looks like "nothing happened". Passing the calling window (same
// pattern export:monthlyExcel already uses for showSaveDialog) keeps it properly in front.
ipcMain.handle("dialog:pickFile", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options: Electron.OpenDialogOptions = { properties: ["openFile"] };
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  return { path: filePath, name: path.basename(filePath) };
});

ipcMain.handle("dialog:pickFolder", async (event, defaultPath?: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options: Electron.OpenDialogOptions = {
    properties: ["openDirectory"],
    ...(defaultPath ? { defaultPath: resolveAppPath(defaultPath) } : {})
  };
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return { path: result.filePaths[0] };
});

// Shortcuts shown in the built-in file navigator (월간 정리 Excel 내보내기 전용 - see the comment on
// export:monthlyExcel above). Resolved via Electron's app.getPath (Node's os.homedir()-derived
// paths), not hardcoded, so they're correct on any machine/user account.
function fileNavigatorShortcuts() {
  return [
    { label: "바탕화면", path: app.getPath("desktop") },
    { label: "내 문서", path: app.getPath("documents") },
    { label: "다운로드", path: app.getPath("downloads") },
    { label: "프로젝트 폴더", path: process.cwd() },
    { label: "프로젝트\\Report 폴더", path: path.join(process.cwd(), "Report") }
  ];
}

// Plain fs.readdir/fs.stat directory listing for the built-in file navigator - used only for
// picking the monthly Excel export's destination folder, as an alternative UI to the OS-native
// folder dialog (dialog:pickFolder above), which this feature deliberately does NOT use.
ipcMain.handle("fs:listDir", async (_event, dirPath?: string) => {
  await requireAdmin();

  const target = dirPath && dirPath.trim() ? resolveAppPath(dirPath.trim()) : app.getPath("documents");
  const shortcuts = fileNavigatorShortcuts();

  try {
    const info = await stat(target);

    if (!info.isDirectory()) {
      throw new Error("폴더가 아닙니다.");
    }

    const rawEntries = await readdir(target, { withFileTypes: true });
    const entries = rawEntries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => ({ name: entry.name, path: path.join(target, entry.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    const parent = path.dirname(target);

    return { path: target, parent: parent === target ? null : parent, entries, shortcuts };
  } catch (error) {
    return {
      path: target,
      parent: null,
      entries: [],
      shortcuts,
      error: error instanceof Error ? error.message : "폴더를 열지 못했습니다."
    };
  }
});

type FolderSettings = {
  dataRootFolder?: string;
  photosFolder?: string;
  bankFolder?: string;
  receiptsFolder?: string;
  expensesFolder?: string;
  planFolder?: string;
  clubLogoPath?: string;
};

const MEDIA_CATEGORIES = ["Photos", "Bank", "Receipts", "Expenses"] as const;

function isValidMediaCategory(category: string): category is (typeof MEDIA_CATEGORIES)[number] {
  return MEDIA_CATEGORIES.includes(category as (typeof MEDIA_CATEGORIES)[number]);
}

function isPathWithinRoot(filePath: string, root: string): boolean {
  const relativePath = path.relative(root, filePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function getAllowedMediaRoots(settings: FolderSettings | null): string[] {
  if (!settings) {
    return [];
  }

  return MEDIA_CATEGORIES.map((category) => resolveCategoryFolder(settings, category))
    .concat(resolvePlanFolder(settings))
    .filter((folder): folder is string => Boolean(folder))
    .map((folder) => resolveAppPath(folder));
}

function isAllowedLocalFilePath(filePath: string, settings: FolderSettings | null): boolean {
  const roots = getAllowedMediaRoots(settings);
  const isWithinMediaRoot = roots.some((root) => isPathWithinRoot(filePath, root));
  const isLogoFile = Boolean(settings?.clubLogoPath) && filePath === resolveAppPath(settings!.clubLogoPath!);

  return isWithinMediaRoot || isLogoFile;
}

function isMonthlyExcelReportPath(filePath: string): boolean {
  return /^club-management-\d{4}-\d{2}-monthly-report\.xlsx$/i.test(path.basename(filePath));
}

ipcMain.handle(
  "media:scanFolder",
  async (_event, category: "Photos" | "Bank" | "Receipts" | "Expenses", yyyyMm: string, week: number) => {
    await requireMember();

    if (!isValidMediaCategory(category)) {
      return { folder: "", files: [] };
    }

    const settings = await readJson<FolderSettings | null>("app-settings.json", null);
    const categoryRoot = settings ? resolveCategoryFolder(settings, category) : null;

    if (!categoryRoot) {
      return { folder: "", files: [] };
    }

    const folder = path.join(categoryRoot, yyyyMm, `Week${week}`);
    const entries = await readdir(resolveAppPath(folder), { withFileTypes: true }).catch(() => []);
    const files = entries
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => toClubMediaUrl(path.join(folder, entry.name)));

    return { folder, files };
  }
);

ipcMain.handle("media:findPlanFiles", async (_event, yyyyMm: string, week: number) => {
  await requireMember();
  const settings = await readJson<FolderSettings | null>("app-settings.json", null);
  const folder = settings ? resolvePlanFolder(settings) : null;

  if (!folder) {
    return [];
  }

  const prefix = `${yyyyMm}-Week${week}`;
  const entries = await readdir(resolveAppPath(folder), { withFileTypes: true }).catch(() => []);
  const matches = entries
    .filter(
      (entry) =>
        entry.isFile() && entry.name.startsWith(prefix) && PLAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    )
    .map((entry) => entry.name)
    .sort();

  return matches.map((name) => ({ path: path.join(folder, name), name }));
});

ipcMain.handle("media:ensureFolders", async (_event, yyyyMm: string, week: number) => {
  await requireMember();
  const settings = await readJson<FolderSettings | null>("app-settings.json", null);

  if (!settings) {
    return { ok: false };
  }

  const targets = MEDIA_CATEGORIES.map((category) => resolveCategoryFolder(settings, category))
    .filter((folder): folder is string => Boolean(folder))
    .map((folder) => path.join(folder, yyyyMm, `Week${week}`));

  const planFolder = resolvePlanFolder(settings);

  if (planFolder) {
    targets.push(planFolder);
  }

  await Promise.all(targets.map((folder) => mkdir(resolveAppPath(folder), { recursive: true }).catch(() => undefined)));

  return { ok: true };
});

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Club Management",
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
    return;
  }

  void win.loadFile(path.join(__dirname, "../dist/index.html"));
};

void app.whenReady().then(async () => {
  protocol.handle(CLUB_MEDIA_SCHEME, async (request) => {
    const member = await getSessionMember();

    if (!member) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const resolvedPath = resolveAppPath(filePath);
    const settings = await readJson<FolderSettings | null>("app-settings.json", null);

    if (!isAllowedLocalFilePath(resolvedPath, settings)) {
      return new Response("Forbidden", { status: 403 });
    }

    return net.fetch(pathToFileURL(resolvedPath).href);
  });

  await seedInitialAdmin();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
