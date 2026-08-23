import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { buildMonthlyReportWorkbook } from "./server/excelExport.js";
import { resolveAppPath, resolveCategoryFolder, resolvePlanFolder } from "./server/paths.js";
import {
  isActivityListStructuralChange,
  isBoardEditBeyondMemberPermissions,
  isBoardPostListForPermissionCheck,
  isEditBeyondSelfAttendanceToggle,
  sanitizeSelfMemberEdit
} from "./server/auth.js";

type FolderSettings = {
  dataRootFolder?: string;
  photosFolder?: string;
  receiptsFolder?: string;
  expensesFolder?: string;
  planFolder?: string;
  clubLogoPath?: string;
};

interface ActivityForAuthCheck {
  id: string;
  title: unknown;
  content: unknown;
  date: unknown;
  weekOfMonth: unknown;
  planFilePaths: unknown;
  attendeeIds: string[];
  photoFileNames: unknown;
  receiptFileNames: unknown;
  expenseFileNames: unknown;
  receipts: unknown;
  expenses: unknown;
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
const IMAGE_CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf"
};

// These dev-only /api/* routes only ever expect requests from this app's own dev-server
// origin. Without this check, any other page open in the same browser could blind-POST here
// while `npm run dev` is running.
const TRUSTED_API_ORIGINS = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);

function isTrustedApiRequest(request: IncomingMessage) {
  const secFetchSite = request.headers["sec-fetch-site"];

  if (typeof secFetchSite === "string") {
    return secFetchSite === "same-origin" || secFetchSite === "none";
  }

  const origin = request.headers.origin;

  return !origin || TRUSTED_API_ORIGINS.has(origin);
}

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";

    request.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function isPathWithinRoot(filePath: string, root: string): boolean {
  const relativePath = path.relative(root, filePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function hashPassword(password: string) {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

function toPublicMember<T extends { passwordHash?: string }>(member: T) {
  const { passwordHash, ...rest } = member;
  return rest;
}

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

// --------------------------------------------------------------------------------------------
// Session handling. Browsing straight to this dev server's LAN address (`npm run dev --host`)
// used to reach every /api/* route with zero authentication - anyone on the network could read
// or overwrite club data without ever logging in. Sessions are an in-memory token -> memberId
// map (fine for a single dev-server process) backed by an httpOnly cookie.
// --------------------------------------------------------------------------------------------

const SESSION_COOKIE = "club_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const sessions = new Map<string, string>();

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};

  (header ?? "").split(";").forEach((part) => {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
  });

  return cookies;
}

function setSessionCookie(response: ServerResponse, token: string) {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`
  );
}

function clearSessionCookie(response: ServerResponse) {
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

async function getSessionMember(request: IncomingMessage): Promise<StoredMember | null> {
  const token = parseCookies(request.headers.cookie).club_session;

  if (!token) {
    return null;
  }

  const memberId = sessions.get(token);

  if (!memberId) {
    return null;
  }

  const members = await readJson<StoredMember[]>("members.json", []);
  const member = members.find((candidate) => candidate.id === memberId);

  if (!member || member.withdrawn) {
    sessions.delete(token);
    return null;
  }

  return member;
}

// On failure these send the response themselves and return null, so callers just need to
// `if (!requester) return;` right after calling.
async function requireMember(request: IncomingMessage, response: ServerResponse): Promise<StoredMember | null> {
  const member = await getSessionMember(request);

  if (!member) {
    sendJson(response, 401, { ok: false, error: "로그인이 필요합니다." });
    return null;
  }

  return member;
}

async function requireAdmin(request: IncomingMessage, response: ServerResponse): Promise<StoredMember | null> {
  const member = await requireMember(request, response);

  if (!member) {
    return null;
  }

  if (member.role !== "admin") {
    sendJson(response, 403, { ok: false, error: "권한이 없습니다. admin만 접근할 수 있습니다." });
    return null;
  }

  return member;
}

// Vite's dev middleware only serves files known to its module graph / public dir, so this
// app-specific data API is registered directly on the underlying Node http server instead.
function clubDevApiPlugin() {
  return {
    name: "club-dev-api",
    async configureServer(server: import("vite").ViteDevServer) {
      // Mirrors the seed step in electron/main.ts so `npm run dev` (browser, no Electron) can
      // log in without requiring the desktop build to run first.
      const existingMembers = await readJson<Array<Record<string, unknown>>>("members.json", []);

      if (existingMembers.length === 0) {
        await writeJson("members.json", [
          {
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
          }
        ]);
      }

      // Settings must stay readable pre-login - the login screen itself shows the club name.
      server.middlewares.use("/api/settings", async (request, response) => {
        if (request.method === "GET") {
          return sendJson(response, 200, await readJson("app-settings.json", null));
        }

        if (request.method === "PUT") {
          if (!isTrustedApiRequest(request)) {
            response.statusCode = 403;
            response.end();
            return;
          }

          const requester = await requireAdmin(request, response);
          if (!requester) return;

          const body = JSON.parse((await readRequestBody(request)) || "{}");
          await writeJson("app-settings.json", body);
          return sendJson(response, 200, { ok: true });
        }

        response.statusCode = 405;
        response.end();
      });

      server.middlewares.use("/api/members/import", async (request, response) => {
        if (request.method !== "POST" || !isTrustedApiRequest(request)) {
          response.statusCode = 405;
          response.end();
          return;
        }

        const requester = await requireAdmin(request, response);
        if (!requester) return;

        const body = JSON.parse((await readRequestBody(request)) || "{}");
        const rows: Array<Record<string, unknown>> = body.rows ?? [];
        const mode: "append" | "replace" = body.mode ?? "append";
        const initialPassword: string = body.initialPassword ?? "";
        const existing = mode === "replace" ? [] : await readJson<Array<Record<string, unknown>>>("members.json", []);
        // Skip rows whose Knox ID already exists (in the current roster, or earlier in this
        // same batch) - Knox ID is how login and every other lookup identifies a member.
        const seenKnoxIds = new Set(existing.map((member) => member.knoxId));
        const imported: Array<Record<string, unknown>> = [];

        rows.forEach((row: Record<string, unknown>, index: number) => {
          const knoxId = String(row.knoxId ?? "");

          if (seenKnoxIds.has(knoxId)) {
            return;
          }

          seenKnoxIds.add(knoxId);
          imported.push({
            ...row,
            id: `member-${Date.now()}-${index}-${Math.round(Math.random() * 1000)}`,
            passwordHash: hashPassword(initialPassword || knoxId),
            withdrawn: false
          });
        });

        const merged = [...existing, ...imported];

        await writeJson("members.json", merged);
        sendJson(response, 200, merged.map(toPublicMember));
      });

      server.middlewares.use("/api/assets-members-file", async (request, response) => {
        const requester = await requireAdmin(request, response);
        if (!requester) return;

        const url = new URL(request.url ?? "", "http://127.0.0.1");
        const format = url.searchParams.get("format") === "json" ? "json" : "txt";
        const fileName = format === "json" ? "members.json" : "members.txt";
        const settings = await readJson<{ memberImportFilePath?: string } | null>("app-settings.json", null);
        const filePath = settings?.memberImportFilePath
          ? resolveAppPath(settings.memberImportFilePath)
          : path.join(process.cwd(), "assets", fileName);

        try {
          const content = await readFile(filePath, "utf8");
          sendJson(response, 200, content);
        } catch {
          sendJson(response, 200, null);
        }
      });

      server.middlewares.use("/api/members", async (request, response) => {
        // 열람 (read) requires being a logged-in member; write actions are further restricted below.
        const requester = await requireMember(request, response);
        if (!requester) return;

        const members = await readJson<StoredMember[]>("members.json", []);

        if (request.method === "GET") {
          return sendJson(response, 200, members.map(toPublicMember));
        }

        if (!isTrustedApiRequest(request)) {
          response.statusCode = 403;
          response.end();
          return;
        }

        if (request.method === "POST") {
          if (requester.role !== "admin") {
            return sendJson(response, 403, { ok: false, error: "권한이 없습니다. admin만 회원을 추가할 수 있습니다." });
          }

          const input = JSON.parse((await readRequestBody(request)) || "{}");
          const { password, ...rest } = input;
          const member = {
            ...rest,
            id: `member-${Date.now()}-${Math.round(Math.random() * 1000)}`,
            passwordHash: hashPassword(password || rest.knoxId),
            withdrawn: false
          };

          members.push(member);
          await writeJson("members.json", members);
          return sendJson(response, 200, members.map(toPublicMember));
        }

        if (request.method === "PUT") {
          const { newPassword, ...rest } = JSON.parse((await readRequestBody(request)) || "{}");

          // Anyone can edit their own record (Profile screen); editing someone else's requires
          // admin. Either way, role/grade/knoxId can only ever change through the admin path -
          // otherwise a self-edit request could smuggle a role escalation through this endpoint.
          if (requester.role !== "admin" && rest.id !== requester.id) {
            return sendJson(response, 403, { ok: false, error: "권한이 없습니다. 본인 정보만 수정할 수 있습니다." });
          }

          const existing = members.find((member) => member.id === rest.id);

          if (!existing) {
            return sendJson(response, 404, { ok: false, error: "회원을 찾을 수 없습니다." });
          }

          const safeRest = requester.role === "admin" ? rest : sanitizeSelfMemberEdit(existing, rest);
          const nextMembers = members.map((member) =>
            member.id === safeRest.id
              ? { ...member, ...safeRest, ...(newPassword ? { passwordHash: hashPassword(newPassword) } : {}) }
              : member
          );

          await writeJson("members.json", nextMembers);
          return sendJson(response, 200, nextMembers.map(toPublicMember));
        }

        if (request.method === "DELETE") {
          if (requester.role !== "admin") {
            return sendJson(response, 403, { ok: false, error: "권한이 없습니다. admin만 회원을 삭제할 수 있습니다." });
          }

          // Soft delete - see the matching comment on electron/main.ts's members:remove handler.
          const url = new URL(request.url ?? "", "http://127.0.0.1");
          const id = url.searchParams.get("id");
          const nextMembers = members.map((member) => (member.id === id ? { ...member, withdrawn: true } : member));

          await writeJson("members.json", nextMembers);
          return sendJson(response, 200, nextMembers.map(toPublicMember));
        }

        response.statusCode = 405;
        response.end();
      });

      server.middlewares.use("/api/auth/login", async (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end();
          return;
        }

        const { knoxId, password } = JSON.parse((await readRequestBody(request)) || "{}");
        const members = await readJson<StoredMember[]>("members.json", []);
        const found = members.find((member) => member.knoxId === knoxId);

        if (!found || found.passwordHash !== hashPassword(password ?? "")) {
          return sendJson(response, 200, { ok: false, error: "Knox ID 또는 비밀번호가 올바르지 않습니다." });
        }

        if (found.withdrawn) {
          return sendJson(response, 200, { ok: false, error: "탈퇴한 회원입니다." });
        }

        const token = randomBytes(32).toString("hex");
        sessions.set(token, found.id);
        setSessionCookie(response, token);

        sendJson(response, 200, { ok: true, member: toPublicMember(found) });
      });

      server.middlewares.use("/api/auth/logout", async (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end();
          return;
        }

        const token = parseCookies(request.headers.cookie).club_session;

        if (token) {
          sessions.delete(token);
        }

        clearSessionCookie(response);
        sendJson(response, 200, { ok: true });
      });

      // Lets the client reconcile its cached session against what the server actually still
      // considers valid (cookie expired, session lost on dev-server restart, member withdrawn).
      server.middlewares.use("/api/auth/session", async (request, response) => {
        if (request.method !== "GET") {
          response.statusCode = 405;
          response.end();
          return;
        }

        const member = await getSessionMember(request);
        sendJson(response, 200, member ? { ok: true, member: toPublicMember(member) } : { ok: false });
      });

      server.middlewares.use("/api/activities", async (request, response) => {
        const requester = await requireMember(request, response);
        if (!requester) return;

        if (request.method === "GET") {
          return sendJson(response, 200, await readJson("activities.json", []));
        }

        if (request.method === "PUT" && isTrustedApiRequest(request)) {
          const body = JSON.parse((await readRequestBody(request)) || "[]");
          const current = await readJson<ActivityForAuthCheck[]>("activities.json", []);

          if (requester.role !== "admin") {
            // 활동 등록/삭제(구조적 변경)는 admin만. 이미 있는 활동에 대해서도 일반 회원이 바꿀 수
            // 있는 건 본인 참석 여부 하나뿐 - 제목/내용/계획서/사진/영수증/경비, 다른 사람의 참석
            // 여부는 전부 admin만 수정 가능하다 (열람은 그대로 가능).
            if (isActivityListStructuralChange(current, body)) {
              return sendJson(response, 403, { ok: false, error: "권한이 없습니다. admin만 활동을 등록/삭제할 수 있습니다." });
            }

            if (isEditBeyondSelfAttendanceToggle(current, body, requester.id)) {
              return sendJson(response, 403, {
                ok: false,
                error: "권한이 없습니다. 본인 참석 여부 외의 항목은 admin만 수정할 수 있습니다."
              });
            }
          }

          await writeJson("activities.json", body);
          return sendJson(response, 200, body);
        }

        response.statusCode = 405;
        response.end();
      });

      server.middlewares.use("/api/board", async (request, response) => {
        const requester = await requireMember(request, response);
        if (!requester) return;

        if (request.method === "GET") {
          return sendJson(response, 200, await readJson("board.json", []));
        }

        if (request.method === "PUT" && isTrustedApiRequest(request)) {
          const body = JSON.parse((await readRequestBody(request)) || "[]");

          if (!isBoardPostListForPermissionCheck(body)) {
            return sendJson(response, 400, { ok: false, error: "게시글 데이터 형식이 올바르지 않습니다." });
          }

          const current = await readJson<BoardPostForAuthCheck[]>("board.json", []);

          if (requester.role !== "admin" && isBoardEditBeyondMemberPermissions(current, body, requester.id)) {
            return sendJson(response, 403, { ok: false, error: "권한이 없습니다. 본인 게시글 삭제와 댓글 작성만 가능합니다." });
          }

          await writeJson("board.json", body);
          return sendJson(response, 200, body);
        }

        response.statusCode = 405;
        response.end();
      });

      server.middlewares.use("/api/export-monthly-excel", async (request, response) => {
        const requester = await requireAdmin(request, response);
        if (!requester) return;

        const url = new URL(request.url ?? "", "http://127.0.0.1");
        const yyyyMm = url.searchParams.get("yyyyMm") ?? "";

        if (!/^\d{4}-\d{2}$/.test(yyyyMm)) {
          response.statusCode = 400;
          response.end();
          return;
        }

        try {
          const workbook = await buildMonthlyReportWorkbook(dataDir, yyyyMm);
          const buffer = await workbook.xlsx.writeBuffer();

          response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          response.setHeader(
            "Content-Disposition",
            `attachment; filename="club-management-${yyyyMm}-monthly-report.xlsx"`
          );
          response.end(Buffer.from(buffer));
        } catch {
          response.statusCode = 500;
          response.end();
        }
      });

      server.middlewares.use("/api/media-scan", async (request, response) => {
        const requester = await requireMember(request, response);
        if (!requester) return;

        const url = new URL(request.url ?? "", "http://127.0.0.1");
        const category = (url.searchParams.get("category") ?? "") as "Photos" | "Receipts" | "Expenses";
        const yyyyMm = url.searchParams.get("yyyyMm") ?? "";
        const week = url.searchParams.get("week") ?? "1";
        const settings = await readJson<FolderSettings | null>("app-settings.json", null);
        const categoryRoot = settings ? resolveCategoryFolder(settings, category) : null;

        if (!categoryRoot) {
          return sendJson(response, 200, { folder: "", files: [] });
        }

        const folder = path.join(categoryRoot, yyyyMm, `Week${week}`);
        const entries = await readdir(resolveAppPath(folder), { withFileTypes: true }).catch(() => []);
        const files = entries
          .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
          .map((entry) => `/api/media?path=${encodeURIComponent(path.join(folder, entry.name))}`);

        sendJson(response, 200, { folder, files });
      });

      server.middlewares.use("/api/plan-find", async (request, response) => {
        const requester = await requireMember(request, response);
        if (!requester) return;

        const url = new URL(request.url ?? "", "http://127.0.0.1");
        const yyyyMm = url.searchParams.get("yyyyMm") ?? "";
        const week = url.searchParams.get("week") ?? "1";
        const settings = await readJson<FolderSettings | null>("app-settings.json", null);
        const folder = settings ? resolvePlanFolder(settings) : null;

        if (!folder) {
          return sendJson(response, 200, []);
        }

        const prefix = `${yyyyMm}-Week${week}`;
        const entries = await readdir(resolveAppPath(folder), { withFileTypes: true }).catch(() => []);
        const matches = entries
          .filter(
            (entry) =>
              entry.isFile() &&
              entry.name.startsWith(prefix) &&
              PLAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
          )
          .map((entry) => entry.name)
          .sort();

        sendJson(
          response,
          200,
          matches.map((name) => ({ path: path.join(folder, name), name }))
        );
      });

      server.middlewares.use("/api/media-ensure-folders", async (request, response) => {
        if (request.method !== "POST" || !isTrustedApiRequest(request)) {
          response.statusCode = 405;
          response.end();
          return;
        }

        const requester = await requireMember(request, response);
        if (!requester) return;

        const body = JSON.parse((await readRequestBody(request)) || "{}");
        const yyyyMm = String(body.yyyyMm ?? "");
        const week = String(body.week ?? "1");
        const settings = await readJson<FolderSettings | null>("app-settings.json", null);

        if (!settings) {
          return sendJson(response, 200, { ok: false });
        }

        const categories: Array<"Photos" | "Receipts" | "Expenses"> = ["Photos", "Receipts", "Expenses"];
        const targets = categories
          .map((category) => resolveCategoryFolder(settings, category))
          .filter((folder): folder is string => Boolean(folder))
          .map((folder) => path.join(folder, yyyyMm, `Week${week}`));
        const planFolder = resolvePlanFolder(settings);

        if (planFolder) {
          targets.push(planFolder);
        }

        await Promise.all(
          targets.map((folder) => mkdir(resolveAppPath(folder), { recursive: true }).catch(() => undefined))
        );

        sendJson(response, 200, { ok: true });
      });

      server.middlewares.use("/api/media", async (request, response) => {
        const requester = await requireMember(request, response);
        if (!requester) return;

        const url = new URL(request.url ?? "", "http://127.0.0.1");
        const requestedPath = url.searchParams.get("path");

        if (!requestedPath) {
          response.statusCode = 400;
          response.end();
          return;
        }

        // This endpoint must only ever serve files under one of the configured media roots (or
        // the club logo itself) - otherwise the query param would let any local page read
        // arbitrary files on disk.
        const settings = await readJson<FolderSettings | null>("app-settings.json", null);
        const roots = settings
          ? (["Photos", "Receipts", "Expenses"] as const)
              .map((category) => resolveCategoryFolder(settings, category))
              .concat(resolvePlanFolder(settings))
              .filter((folder): folder is string => Boolean(folder))
              .map((folder) => resolveAppPath(folder))
          : [];
        const filePath = resolveAppPath(requestedPath);
        const isWithinAnyRoot = roots.some((root) => isPathWithinRoot(filePath, root));
        const isLogoFile = Boolean(settings?.clubLogoPath) && filePath === resolveAppPath(settings!.clubLogoPath!);

        if (!isWithinAnyRoot && !isLogoFile) {
          response.statusCode = 403;
          response.end();
          return;
        }

        try {
          const fileStat = await stat(filePath);

          if (!fileStat.isFile()) {
            throw new Error("Not a file");
          }

          const extension = path.extname(filePath).toLowerCase();
          const contentType = IMAGE_CONTENT_TYPES[extension];

          if (!contentType) {
            response.statusCode = 415;
            response.end();
            return;
          }

          response.setHeader("Content-Type", contentType);
          response.end(await readFile(filePath));
        } catch {
          response.statusCode = 404;
          response.end();
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), clubDevApiPlugin()],
  server: {
    port: 5173
  }
});
