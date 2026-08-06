import type { MemberGrade, MemberRole, PublicMember } from "../types/domain";

export interface MemberDraft {
  name: string;
  knoxId: string;
  department: string;
  contact: string;
  joinDate: string;
  grade: MemberGrade;
  role: MemberRole;
  note?: string;
}

export async function listMembers(): Promise<PublicMember[]> {
  if (window.clubApp?.listMembers) {
    return window.clubApp.listMembers();
  }

  const response = await fetch("/api/members");
  return response.ok ? response.json() : [];
}

export async function addMember(draft: MemberDraft, password: string): Promise<PublicMember[]> {
  const payload = { ...draft, password };

  if (window.clubApp?.addMember) {
    return window.clubApp.addMember(payload);
  }

  const response = await fetch("/api/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return response.json();
}

export async function updateMember(member: PublicMember): Promise<PublicMember[]> {
  if (window.clubApp?.updateMember) {
    return window.clubApp.updateMember(member);
  }

  const response = await fetch("/api/members", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(member)
  });

  return response.json();
}

export async function removeMember(id: string): Promise<PublicMember[]> {
  if (window.clubApp?.removeMember) {
    return window.clubApp.removeMember(id);
  }

  const response = await fetch(`/api/members?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  return response.json();
}

// Newly imported members get their Knox ID as the initial password (they can change it later).
export async function importMembers(rows: MemberDraft[]): Promise<PublicMember[]> {
  if (window.clubApp?.importMembers) {
    return window.clubApp.importMembers(rows);
  }

  const response = await fetch("/api/members/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows)
  });

  return response.json();
}

export function downloadMembersJson(members: PublicMember[]) {
  const json = JSON.stringify(members, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `club-members-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const VALID_GRADES: MemberGrade[] = ["회장", "총무", "감사", "정회원"];
const VALID_ROLES: MemberRole[] = ["admin", "일반"];

export function parseMembersJson(jsonText: string): MemberDraft[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      name: String(entry.name ?? ""),
      knoxId: String(entry.knoxId ?? ""),
      department: String(entry.department ?? ""),
      contact: String(entry.contact ?? ""),
      joinDate: String(entry.joinDate ?? ""),
      grade: VALID_GRADES.includes(entry.grade as MemberGrade) ? (entry.grade as MemberGrade) : "정회원",
      role: VALID_ROLES.includes(entry.role as MemberRole) ? (entry.role as MemberRole) : "일반",
      note: entry.note ? String(entry.note) : ""
    }))
    .filter((draft) => draft.name && draft.knoxId);
}
