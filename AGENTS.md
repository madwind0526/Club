# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Club Management is a Korean-language desktop app for running a company club/hobby group: member roster, activity scheduling with attendance, a notice/discussion board, and (later) weekly/monthly activity reports. Built with Electron + React + TypeScript + Vite, following the same architecture as `SNS-Reader` in this workspace but with a fully grayscale, minimal visual design.

## Commands

```bash
npm install     # Install dependencies
npm run dev     # Vite dev server only, browser at http://127.0.0.1:5173 (uses /api/* fallback instead of Electron IPC)
npm start       # Build electron main, start Vite dev server, launch Electron window (tools/start-app.mjs)
npm run build   # tsc -b && vite build && tsc -p tsconfig.node.json
```

On Windows, `start.bat`/`stop.bat` (project root) wrap `npm start` with a port-5173 cleanup step first (find+kill whatever's listening there via `netstat`/`taskkill`, `stop.bat` also closes the "Club Management" window) - mirrors the same scripts in `SNS-Reader`. Useful since a leftover dev server from *either* project can end up shadowing the other's on port 5173.

## Architecture

- **`electron/main.ts`** — Main process. Creates the BrowserWindow, registers the `club-media://` protocol (see below), and exposes IPC handlers for members/activities/board/settings CRUD (JSON files under `data/runtime/`), `auth:login` (Knox ID + SHA-256 password check), `dialog:pickFile` / `shell:openPath`, `media:scanFolder` / `media:findPlanFiles` / `media:ensureFolders`, `assets:readMembersFile`, and `export:monthlyExcel` (native Save-As dialog + `server/excelExport.ts`).
- **`electron/preload.ts`** — Exposes `window.clubApp` to the renderer via contextBridge.
- **`vite.config.mts`** — React plugin + `/api/*` dev-only middleware mirroring every IPC handler above (including `/api/export-monthly-excel`, which streams the xlsx as a normal file download), so `npm run dev` works in a plain browser without Electron (same dual-path pattern as SNS-Reader).
- **`server/excelExport.ts`** — Node-only module (no renderer imports) shared by `electron/main.ts` and `vite.config.mts`, building the monthly-report `.xlsx` workbook with ExcelJS. Included in `tsconfig.node.json`.
- **`server/paths.ts`** — `resolveAppPath()` (= `path.resolve()`, documented for intent) and the Photos/Receipts/Expenses/Plan folder-override resolution helpers, shared by `electron/main.ts`, `vite.config.mts`, and `server/excelExport.ts`.
- **Local file rendering (`club-media://`)** — The renderer runs on an http(s) origin, so Chromium blocks `file://` as a subresource. `toDisplayableFileUrl()` (`src/utils/fileUrl.ts`) rewrites a raw OS path into `club-media://local/<encoded path>`, and `electron/main.ts` registers a privileged protocol handler that decodes it back and streams the file via `net.fetch`. Any code that needs to read the same file on disk (e.g. `server/excelExport.ts` embedding it into Excel) reverses the same encoding.
- **Path portability** — Stored paths (`clubLogoPath`, `dataRootFolder` and its per-category overrides, `Activity.planFilePaths`) may be relative; every place that actually touches the filesystem (the `club-media://` handler, `shell:openPath`, `server/excelExport.ts`'s image reads) resolves through `resolveAppPath()` first, which treats a relative path as relative to `process.cwd()` (the project root in `npm run dev`/`npm start`). This is why the bundled sample data (`data/runtime/app-settings.json`, `activities.json`) stores `assets/Logo.png` and `Input/...` as relative paths rather than machine-specific absolute ones — an absolute path baked into committed sample data only works on the machine it was captured on.
- **`src/data/*Store.ts`** — One module per entity (`settingsStore`, `membersStore`, `activitiesStore`, `boardStore`, `authStore`, `mediaStore`). Each tries `window.clubApp?.xxx?.()` first, falls back to `fetch('/api/...')`.
- **`src/App.tsx`** — Renders `LoginView` full-screen when no session, otherwise the app shell (`TopToolbar` + `Sidebar` + view + `system-message` footer) from `src/components/layout/`. `ActivityQuickViewModal`, `ActivityReportView`, and `MonthlyReportDetail` are all rendered as popups from `App.tsx`, not full-page routes.
- **`src/components/views/*`** — One component per screen (Home, Activities, ActivityRegister, ActivityReport, WeeklyReport, MonthlyReport + MonthlyReportDetail, Board, Members, Settings, Profile, Login), plus shared pieces (`ActivityListTable`, `PlanFileControls`).
- **`src/types/domain.ts`** — Member / Activity / BoardPost / AppSettings types shared by client and (loosely, via a duplicated shape — see `server/excelExport.ts`'s own interfaces) the Node-side code.

## Key Conventions

- All UI text is in Korean. Code comments are English-only (see global rule G-01).
- Data persists as local JSON files under `data/runtime/` — no database. These files **are committed** (sample/demo content), unlike a typical `.gitignore`'d local-data folder; keep that in mind before overwriting them with throwaway test data.
- Passwords are stored as SHA-256 hashes and only ever compared/hashed inside the main process or the dev-server middleware, never in renderer code. `members:update` accepts an optional `newPassword` field (used by the Profile screen's self-service password change) alongside the normal profile fields.
- Photos/receipts/expenses live under a user-configured "데이터 루트 폴더" (Settings), structured as `Photos|Receipts|Expenses/YYYY-MM/WeekN/`; each category can also be pointed at its own folder in Settings (empty falls back to `<데이터 루트 폴더>/<category>`). The activity plan file(s) live at `<Plan 폴더>/YYYY-MM-WeekN.<ext>` (jpg/jpeg/gif/png/doc/docx/xls/xlsx/ppt/pptx/pdf) — `Activity.planFilePaths` is an array; auto-detect matches by prefix and returns **every** matching file (e.g. `2026-07-Week3.jpg` and `2026-07-Week3_계획서.pptx` both match and both get attached), not just the first. Registering a new activity auto-creates that week's Photos/Receipts/Expenses/Plan folders (`media:ensureFolders`).
- Member import/export format (JSON vs. tab-separated TXT) and mode (append vs. replace) are both configured in Settings and apply to all three of MembersView's 불러오기(file picker)/자동불러오기(reads Settings' `memberImportFilePath`, or `assets\members.json`/`.txt` if unset)/내보내기 buttons. Import always skips rows whose Knox ID already exists, and takes an optional shared initial password (applies to every imported row including admin ones; falls back to each row's own Knox ID when blank).
- Sponsorship ("활동비") amounts are configured in Settings (`sponsorshipSingleAttendance`/`sponsorshipMultipleAttendance`, default 5,000/10,000원) rather than hardcoded — read independently by `MonthlyReportDetail.tsx` (via the `settings` prop) and `server/excelExport.ts` (via `app-settings.json`, since it has no access to renderer state).
- Visual design: true grayscale palette (not SNS-Reader's cream tone) — see `src/styles/app.css` `:root` tokens. Completed/upcoming status badges are the one deliberate exception (green/blue), plus a minimal red for destructive actions.
- Weekly report (admin-only) lists all activities and opens the same report popup used elsewhere. Monthly report aggregates a month's activities into one combined view and can be exported to `.xlsx`. The Summary sheet and each week sheet share the same panel layout and order (사진 → 참여인원 → 영수증 → 경비, each with its own title/sub-label, plus 활동비/영수증/경비 1x2 totals beside their tables/photos) — Summary's 참여인원 panel lists every member (O marks per week attended), while a week sheet's panel lists only that activity's actual attendees.

---

## 글로벌 Knowledge Base 규칙

`C:\Codex\memory-bank\INDEX.md`에는 여러 프로젝트에서 확실하게 확인된 문제 해결법이 저장되어 있다.

### 새 프로젝트 시작 전

1. `C:\Codex\memory-bank\INDEX.md`를 읽는다
2. 해당 프로젝트의 기술 스택과 관련된 항목을 확인한다
3. 알려진 함정을 미리 피하면서 구현을 진행한다

### 프로젝트 진행 중 또는 완료 후

1. 해당 프로젝트의 `memory-bank/knowledge/trouble-shooting.md`와 `CACHE.md`를 확인한다
2. **다른 프로젝트에서도 재현될 수 있는 문제와 해결법**을 `C:\Codex\memory-bank\`에 추가한다
3. `INDEX.md`에 새 항목 링크를 추가한다

### 추가 기준

- 실제 기기/환경에서 확인된 사실만 저장 (추측 금지)
- 원인 + 해결 코드가 명확히 있는 것만
- 단일 프로젝트 특이사항이 아닌, **재사용 가능한** 지식
