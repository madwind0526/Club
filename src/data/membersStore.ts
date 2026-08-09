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

// withdrawn isn't editable through this form - it's only ever changed by removeMember() (soft
// delete) - so it's excluded here rather than requiring every call site to carry it along.
export async function updateMember(
  member: Omit<PublicMember, "withdrawn"> & { newPassword?: string }
): Promise<PublicMember[]> {
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

// Newly imported members get `initialPassword` (applies to every row, admin included) when set,
// otherwise each row's own Knox ID as the initial password (they can change it later). Mode
// "replace" discards the existing member list before adding the imported rows.
export async function importMembers(
  rows: MemberDraft[],
  mode: "append" | "replace" = "append",
  initialPassword = ""
): Promise<PublicMember[]> {
  if (window.clubApp?.importMembers) {
    return window.clubApp.importMembers(rows, mode, initialPassword);
  }

  const response = await fetch("/api/members/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows, mode, initialPassword })
  });

  return response.json();
}

// Reads members.json/members.txt bundled under assets/, used by the "자동불러오기" button in
// MembersView.
export async function readAssetsMembersFile(format: "json" | "txt"): Promise<string | null> {
  if (window.clubApp?.readAssetsMembersFile) {
    return window.clubApp.readAssetsMembersFile(format);
  }

  const response = await fetch(`/api/assets-members-file?format=${format}`);

  return response.ok ? response.json() : null;
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

const TEXT_HEADERS = ["이름", "Knox ID", "부서", "연락처", "가입 날짜", "회원 등급", "역할", "비고"];

// Tab-separated, matching Excel's "텍스트(탭으로 구분)" .txt export - the same shape parseMembersText reads.
export function membersToText(members: PublicMember[]) {
  const lines = [TEXT_HEADERS.join("\t")];

  members.forEach((member) => {
    lines.push(
      [member.name, member.knoxId, member.department, member.contact, member.joinDate, member.grade, member.role, member.note ?? ""].join(
        "\t"
      )
    );
  });

  return lines.join("\n");
}

export function downloadMembersText(members: PublicMember[]) {
  const text = membersToText(members);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `club-members-${new Date().toISOString().slice(0, 10)}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const VALID_GRADES: MemberGrade[] = ["회장", "총무", "감사", "정회원"];
const VALID_ROLES: MemberRole[] = ["admin", "일반"];

function toGrade(value: unknown): MemberGrade {
  return VALID_GRADES.includes(value as MemberGrade) ? (value as MemberGrade) : "정회원";
}

function toRole(value: unknown): MemberRole {
  return VALID_ROLES.includes(value as MemberRole) ? (value as MemberRole) : "일반";
}

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
      grade: toGrade(entry.grade),
      role: toRole(entry.role),
      note: entry.note ? String(entry.note) : ""
    }))
    .filter((draft) => draft.name && draft.knoxId);
}

// Accepts a plain-text export with one member per line, tab-separated (Excel's
// "텍스트(탭으로 구분)" .txt format): 이름, Knox ID, 부서, 연락처, 가입 날짜, 회원 등급, 역할, 비고.
// Falls back to comma-separated if the line has no tabs.
export function parseMembersText(text: string): MemberDraft[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length <= 1) {
    return [];
  }

  return lines
    .slice(1)
    .map((line) => {
      const fields = (line.includes("\t") ? line.split("\t") : line.split(",")).map((field) => field.trim());
      const [name, knoxId, department, contact, joinDate, grade, role, note] = fields;

      return {
        name: name ?? "",
        knoxId: knoxId ?? "",
        department: department ?? "",
        contact: contact ?? "",
        joinDate: joinDate ?? "",
        grade: toGrade(grade),
        role: toRole(role),
        note: note ?? ""
      };
    })
    .filter((draft) => draft.name && draft.knoxId);
}
