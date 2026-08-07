import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { buildMonthlyReportWorkbook } from "./server/excelExport.js";

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
  ".bmp": "image/bmp"
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
            note: "초기 관리자 계정 (Settings에서 회원 정보 수정 권장)"
          }
        ]);
      }

      server.middlewares.use("/api/settings", async (request, response) => {
        if (request.method === "GET") {
          return sendJson(response, 200, await readJson("app-settings.json", null));
        }

        if (request.method === "PUT" && isTrustedApiRequest(request)) {
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

        const body = JSON.parse((await readRequestBody(request)) || "{}");
        const rows: Array<Record<string, unknown>> = body.rows ?? [];
        const mode: "append" | "replace" = body.mode ?? "append";
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
            passwordHash: hashPassword(knoxId)
          });
        });

        const merged = [...existing, ...imported];

        await writeJson("members.json", merged);
        sendJson(response, 200, merged.map(toPublicMember));
      });

      server.middlewares.use("/api/assets-members-file", async (request, response) => {
        const url = new URL(request.url ?? "", "http://127.0.0.1");
        const format = url.searchParams.get("format") === "json" ? "json" : "txt";
        const fileName = format === "json" ? "members.json" : "members.txt";

        try {
          const content = await readFile(path.join(process.cwd(), "assets", fileName), "utf8");
          sendJson(response, 200, content);
        } catch {
          sendJson(response, 200, null);
        }
      });

      server.middlewares.use("/api/members", async (request, response) => {
        const members = await readJson<Array<Record<string, unknown>>>("members.json", []);

        if (request.method === "GET") {
          return sendJson(response, 200, members.map(toPublicMember));
        }

        if (!isTrustedApiRequest(request)) {
          response.statusCode = 403;
          response.end();
          return;
        }

        if (request.method === "POST") {
          const input = JSON.parse((await readRequestBody(request)) || "{}");
          const { password, ...rest } = input;
          const member = {
            ...rest,
            id: `member-${Date.now()}-${Math.round(Math.random() * 1000)}`,
            passwordHash: hashPassword(password || rest.knoxId)
          };

          members.push(member);
          await writeJson("members.json", members);
          return sendJson(response, 200, members.map(toPublicMember));
        }

        if (request.method === "PUT") {
          const { newPassword, ...rest } = JSON.parse((await readRequestBody(request)) || "{}");
          const nextMembers = members.map((member) =>
            member.id === rest.id
              ? { ...member, ...rest, ...(newPassword ? { passwordHash: hashPassword(newPassword) } : {}) }
              : member
          );

          await writeJson("members.json", nextMembers);
          return sendJson(response, 200, nextMembers.map(toPublicMember));
        }

        if (request.method === "DELETE") {
          const url = new URL(request.url ?? "", "http://127.0.0.1");
          const id = url.searchParams.get("id");
          const nextMembers = members.filter((member) => member.id !== id);

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
        const members = await readJson<Array<Record<string, unknown>>>("members.json", []);
        const found = members.find((member) => member.knoxId === knoxId);

        if (!found || found.passwordHash !== hashPassword(password ?? "")) {
          return sendJson(response, 200, { ok: false, error: "Knox ID 또는 비밀번호가 올바르지 않습니다." });
        }

        sendJson(response, 200, { ok: true, member: toPublicMember(found) });
      });

      server.middlewares.use("/api/activities", async (request, response) => {
        if (request.method === "GET") {
          return sendJson(response, 200, await readJson("activities.json", []));
        }

        if (request.method === "PUT" && isTrustedApiRequest(request)) {
          const body = JSON.parse((await readRequestBody(request)) || "[]");
          await writeJson("activities.json", body);
          return sendJson(response, 200, body);
        }

        response.statusCode = 405;
        response.end();
      });

      server.middlewares.use("/api/board", async (request, response) => {
        if (request.method === "GET") {
          return sendJson(response, 200, await readJson("board.json", []));
        }

        if (request.method === "PUT" && isTrustedApiRequest(request)) {
          const body = JSON.parse((await readRequestBody(request)) || "[]");
          await writeJson("board.json", body);
          return sendJson(response, 200, body);
        }

        response.statusCode = 405;
        response.end();
      });

      server.middlewares.use("/api/export-monthly-excel", async (request, response) => {
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
        const url = new URL(request.url ?? "", "http://127.0.0.1");
        const category = url.searchParams.get("category") ?? "";
        const yyyyMm = url.searchParams.get("yyyyMm") ?? "";
        const week = url.searchParams.get("week") ?? "1";
        const settings = await readJson<{ dataRootFolder?: string } | null>("app-settings.json", null);
        const root = settings?.dataRootFolder;

        if (!root) {
          return sendJson(response, 200, { folder: "", files: [] });
        }

        const folder = path.join(root, category, yyyyMm, `Week${week}`);
        const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
        const files = entries
          .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
          .map((entry) => `/api/media?path=${encodeURIComponent(path.join(folder, entry.name))}`);

        sendJson(response, 200, { folder, files });
      });

      server.middlewares.use("/api/plan-find", async (request, response) => {
        const url = new URL(request.url ?? "", "http://127.0.0.1");
        const yyyyMm = url.searchParams.get("yyyyMm") ?? "";
        const week = url.searchParams.get("week") ?? "1";
        const settings = await readJson<{ dataRootFolder?: string } | null>("app-settings.json", null);
        const root = settings?.dataRootFolder;

        if (!root) {
          return sendJson(response, 200, null);
        }

        const folder = path.join(root, "Plan");
        const prefix = `${yyyyMm}-Week${week}`;
        const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
        const match = entries
          .filter(
            (entry) =>
              entry.isFile() &&
              entry.name.startsWith(prefix) &&
              PLAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
          )
          .map((entry) => entry.name)
          .sort()[0];

        sendJson(response, 200, match ? { path: path.join(folder, match), name: match } : null);
      });

      server.middlewares.use("/api/media", async (request, response) => {
        const url = new URL(request.url ?? "", "http://127.0.0.1");
        const requestedPath = url.searchParams.get("path");

        if (!requestedPath) {
          response.statusCode = 400;
          response.end();
          return;
        }

        // This endpoint must only ever serve files under the configured data root -
        // otherwise the query param would let any local page read arbitrary files on disk.
        const settings = await readJson<{ dataRootFolder?: string } | null>("app-settings.json", null);
        const root = settings?.dataRootFolder ? path.resolve(settings.dataRootFolder) : null;
        const filePath = path.resolve(requestedPath);

        if (!root || (filePath !== root && !filePath.startsWith(root + path.sep))) {
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
