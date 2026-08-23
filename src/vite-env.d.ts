/// <reference types="vite/client" />

import type { Activity, AppSettings, BoardPost, LoginResult, MediaScanResult, PublicMember } from "./types/domain";

interface ClubApp {
  platform: string;
  loadSettings: () => Promise<AppSettings | null>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;

  listMembers: () => Promise<PublicMember[]>;
  addMember: (input: unknown) => Promise<PublicMember[]>;
  updateMember: (input: unknown) => Promise<PublicMember[]>;
  removeMember: (id: string) => Promise<PublicMember[]>;
  importMembers: (rows: unknown, mode: "append" | "replace", initialPassword?: string) => Promise<PublicMember[]>;
  readAssetsMembersFile: (format: "json" | "txt") => Promise<string | null>;

  login: (knoxId: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<{ ok: boolean }>;

  listActivities: () => Promise<Activity[]>;
  saveActivities: (activities: Activity[]) => Promise<Activity[]>;

  listBoardPosts: () => Promise<BoardPost[]>;
  saveBoardPosts: (posts: BoardPost[]) => Promise<BoardPost[]>;

  pickFile: () => Promise<{ path: string; name: string } | null>;
  pickFolder: (defaultPath?: string) => Promise<{ path: string } | null>;
  scanMediaFolder: (
    category: "Photos" | "Receipts" | "Expenses",
    yyyyMm: string,
    week: number
  ) => Promise<MediaScanResult>;
  findPlanFiles: (yyyyMm: string, week: number) => Promise<Array<{ path: string; name: string }>>;
  ensureMediaFolders: (yyyyMm: string, week: number) => Promise<{ ok: boolean }>;
  openPath: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
  exportMonthlyExcel: (yyyyMm: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
}

declare global {
  interface Window {
    clubApp?: ClubApp;
  }
}
