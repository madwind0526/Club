import type { LoginResult, PublicMember } from "../types/domain";

const SESSION_STORAGE_KEY = "club-management-session";

export async function login(knoxId: string, password: string): Promise<LoginResult> {
  if (window.clubApp?.login) {
    return window.clubApp.login(knoxId, password);
  }

  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ knoxId, password })
  });

  if (!response.ok) {
    return { ok: false, error: "로그인 요청이 실패했습니다." };
  }

  return (await response.json()) as LoginResult;
}

export function saveSession(member: PublicMember) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(member));
}

export function loadSession(): PublicMember | null {
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PublicMember;
  } catch {
    return null;
  }
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
