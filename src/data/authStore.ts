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

export async function logout(): Promise<void> {
  if (window.clubApp?.logout) {
    await window.clubApp.logout();
    return;
  }

  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
}

// Confirms the cached session against what the server (session cookie / IPC session) actually
// still considers valid - a stale localStorage cache alone must never be trusted for
// authorization, only for what the UI shows before this check comes back.
export async function fetchServerSession(): Promise<PublicMember | null> {
  if (window.clubApp) {
    // Electron's IPC session is tracked in the main process and only ever set by a successful
    // login/list call within this same running app instance - the locally cached member (if
    // any) is what we already trust there, there's no separate handshake needed.
    return loadSession();
  }

  const response = await fetch("/api/auth/session").catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const result = (await response.json()) as { ok: boolean; member?: PublicMember };
  return result.ok && result.member ? result.member : null;
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
