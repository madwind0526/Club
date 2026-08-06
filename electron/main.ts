import { app, BrowserWindow, dialog, ipcMain, net, protocol } from "electron";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);
const PLAN_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".xls", ".xlsx", ".ppt", ".pptx", ".doc", ".docx"]);

const dataDir = path.resolve(process.cwd(), process.env.CLUB_DATA_DIR ?? "data/runtime");

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
    note: "초기 관리자 계정 (Settings에서 회원 정보 수정 권장)"
  };

  await writeJson("members.json", [seedAdmin]);
}

ipcMain.handle("settings:load", () => readJson("app-settings.json", null));

ipcMain.handle("settings:save", async (_event, settings: unknown) => {
  await writeJson("app-settings.json", settings);
  return true;
});

ipcMain.handle("members:list", async () => {
  const members = await readJson<StoredMember[]>("members.json", []);
  return members.map(toPublicMember);
});

ipcMain.handle(
  "members:add",
  async (_event, input: Omit<StoredMember, "id" | "passwordHash"> & { password: string }) => {
    const members = await readJson<StoredMember[]>("members.json", []);
    const { password, ...rest } = input;
    const member: StoredMember = {
      ...rest,
      id: `member-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      passwordHash: hashPassword(password || rest.knoxId)
    };

    members.push(member);
    await writeJson("members.json", members);
    return members.map(toPublicMember);
  }
);

ipcMain.handle("members:update", async (_event, input: Omit<StoredMember, "passwordHash">) => {
  const members = await readJson<StoredMember[]>("members.json", []);
  const nextMembers = members.map((member) => (member.id === input.id ? { ...member, ...input } : member));

  await writeJson("members.json", nextMembers);
  return nextMembers.map(toPublicMember);
});

ipcMain.handle("members:remove", async (_event, id: string) => {
  const members = await readJson<StoredMember[]>("members.json", []);
  const nextMembers = members.filter((member) => member.id !== id);

  await writeJson("members.json", nextMembers);
  return nextMembers.map(toPublicMember);
});

ipcMain.handle(
  "members:import",
  async (_event, rows: Array<Omit<StoredMember, "id" | "passwordHash">>) => {
    const members = await readJson<StoredMember[]>("members.json", []);
    const imported = rows.map((row, index) => ({
      ...row,
      id: `member-${Date.now()}-${index}-${Math.round(Math.random() * 1000)}`,
      passwordHash: hashPassword(row.knoxId)
    }));

    const merged = [...members, ...imported];

    await writeJson("members.json", merged);
    return merged.map(toPublicMember);
  }
);

ipcMain.handle("auth:login", async (_event, knoxId: string, password: string) => {
  const members = await readJson<StoredMember[]>("members.json", []);
  const found = members.find((member) => member.knoxId === knoxId);

  if (!found || found.passwordHash !== hashPassword(password)) {
    return { ok: false, error: "Knox ID 또는 비밀번호가 올바르지 않습니다." };
  }

  return { ok: true, member: toPublicMember(found) };
});

ipcMain.handle("activities:list", () => readJson("activities.json", []));

ipcMain.handle("activities:save", async (_event, activities: unknown) => {
  await writeJson("activities.json", activities);
  return activities;
});

ipcMain.handle("board:list", () => readJson("board.json", []));

ipcMain.handle("board:save", async (_event, posts: unknown) => {
  await writeJson("board.json", posts);
  return posts;
});

ipcMain.handle("dialog:pickFile", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openFile"] });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  return { path: filePath, name: path.basename(filePath) };
});

ipcMain.handle(
  "media:scanFolder",
  async (_event, category: "Photos" | "Receipts" | "Expenses", yyyyMm: string, week: number) => {
    const settings = await readJson<{ dataRootFolder?: string } | null>("app-settings.json", null);
    const root = settings?.dataRootFolder;

    if (!root) {
      return { folder: "", files: [] };
    }

    const folder = path.join(root, category, yyyyMm, `Week${week}`);
    const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
    const files = entries
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => toClubMediaUrl(path.join(folder, entry.name)));

    return { folder, files };
  }
);

ipcMain.handle("media:findPlanFile", async (_event, yyyyMm: string, week: number) => {
  const settings = await readJson<{ dataRootFolder?: string } | null>("app-settings.json", null);
  const root = settings?.dataRootFolder;

  if (!root) {
    return null;
  }

  const folder = path.join(root, "Plan");
  const prefix = `${yyyyMm}-Week${week}`;
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  const match = entries
    .filter(
      (entry) =>
        entry.isFile() && entry.name.startsWith(prefix) && PLAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    )
    .map((entry) => entry.name)
    .sort()[0];

  if (!match) {
    return null;
  }

  return { path: path.join(folder, match), name: match };
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
  protocol.handle(CLUB_MEDIA_SCHEME, (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ""));

    return net.fetch(pathToFileURL(filePath).href);
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
