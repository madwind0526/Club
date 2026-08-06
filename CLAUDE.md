# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Club Management is a Korean-language desktop app for running a company club/hobby group: member roster, activity scheduling with attendance, a notice/discussion board, and (later) weekly/monthly activity reports. Built with Electron + React + TypeScript + Vite, following the same architecture as `SNS-Reader` in this workspace but with a fully grayscale, minimal visual design.

## Commands

```bash
npm install     # Install dependencies
npm run dev     # Vite dev server only, browser at http://127.0.0.1:5173 (uses /api/* fallback instead of Electron IPC)
npm start       # Build electron main, start Vite dev server, launch Electron window (tools/start-app.mjs)
npm run build   # tsc -b && vite build && tsc -p tsconfig.node.json
```

## Architecture

- **`electron/main.ts`** — Main process. Creates the BrowserWindow and exposes IPC handlers for members/activities/board/settings CRUD (JSON files under `data/runtime/`), `auth:login` (Knox ID + SHA-256 password check), `dialog:pickFile` (활동 계획서 첨부), and `media:scanFolder` (scans `<dataRootFolder>/{Photos,Receipts,Expenses}/YYYY-MM/WeekN/`).
- **`electron/preload.ts`** — Exposes `window.clubApp` to the renderer via contextBridge.
- **`vite.config.mts`** — React plugin + `/api/*` dev-only middleware mirroring the IPC handlers, so `npm run dev` works in a plain browser without Electron (same dual-path pattern as SNS-Reader).
- **`src/data/*Store.ts`** — One module per entity (`settingsStore`, `membersStore`, `activitiesStore`, `boardStore`, `authStore`). Each tries `window.clubApp?.xxx?.()` first, falls back to `fetch('/api/...')`.
- **`src/App.tsx`** — Renders `LoginView` full-screen when no session, otherwise the app shell (`TopToolbar` + `Sidebar` + view + `system-message` footer) from `src/components/layout/`.
- **`src/components/views/*`** — One component per screen (Home, Activities, ActivityDetail, ActivityRegister, ActivityReport, Board, Members, WeeklyReport (stub), MonthlyReport (stub), Settings, Profile, Login).
- **`src/types/domain.ts`** — Member / Activity / BoardPost / AppSettings types shared by client and (loosely, via JSDoc-equivalent shapes) the electron main process.

## Key Conventions

- All UI text is in Korean. Code comments are English-only (see global rule G-01).
- Data persists as local JSON files under `data/runtime/` (gitignored) — no database.
- Passwords are stored as SHA-256 hashes and only ever compared inside the main process / dev-server middleware, never in renderer code.
- Photos/receipts/expenses live under a user-configured "데이터 루트 폴더" (Settings), structured as `Photos|Receipts|Expenses/YYYY-MM/WeekN/`.
- Visual design: true grayscale palette (not SNS-Reader's cream tone) — see `src/styles/app.css` `:root` tokens. No saturated accent color except a minimal red for destructive actions.
- Weekly/Monthly report generation (좌측 하단 메뉴) is intentionally a placeholder for now — scope deferred by the user.

---

## 글로벌 Knowledge Base 규칙

`C:\Claude\memory-bank\INDEX.md`에는 여러 프로젝트에서 확실하게 확인된 문제 해결법이 저장되어 있다.

### 새 프로젝트 시작 전

1. `C:\Claude\memory-bank\INDEX.md`를 읽는다
2. 해당 프로젝트의 기술 스택과 관련된 항목을 확인한다
3. 알려진 함정을 미리 피하면서 구현을 진행한다

### 프로젝트 진행 중 또는 완료 후

1. 해당 프로젝트의 `memory-bank/knowledge/trouble-shooting.md`와 `CACHE.md`를 확인한다
2. **다른 프로젝트에서도 재현될 수 있는 문제와 해결법**을 `C:\Claude\memory-bank\`에 추가한다
3. `INDEX.md`에 새 항목 링크를 추가한다

### 추가 기준

- 실제 기기/환경에서 확인된 사실만 저장 (추측 금지)
- 원인 + 해결 코드가 명확히 있는 것만
- 단일 프로젝트 특이사항이 아닌, **재사용 가능한** 지식
