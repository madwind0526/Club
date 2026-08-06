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
  importMembers: (rows: unknown) => Promise<PublicMember[]>;

  login: (knoxId: string, password: string) => Promise<LoginResult>;

  listActivities: () => Promise<Activity[]>;
  saveActivities: (activities: Activity[]) => Promise<Activity[]>;

  listBoardPosts: () => Promise<BoardPost[]>;
  saveBoardPosts: (posts: BoardPost[]) => Promise<BoardPost[]>;

  pickFile: () => Promise<{ path: string; name: string } | null>;
  scanMediaFolder: (
    category: "Photos" | "Receipts" | "Expenses",
    yyyyMm: string,
    week: number
  ) => Promise<MediaScanResult>;
  findPlanFile: (yyyyMm: string, week: number) => Promise<{ path: string; name: string } | null>;
}

declare global {
  interface Window {
    clubApp?: ClubApp;
  }
}
