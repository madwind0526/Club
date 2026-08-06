import { useRef, useState } from "react";
import {
  addMember,
  downloadMembersJson,
  importMembers,
  parseMembersJson,
  removeMember,
  updateMember,
  type MemberDraft
} from "../../data/membersStore";
import type { MemberGrade, MemberRole, PublicMember } from "../../types/domain";

interface MembersViewProps {
  members: PublicMember[];
  currentMember: PublicMember;
  onMembersChange: (members: PublicMember[]) => void;
  onSystemMessage: (message: string) => void;
}

const emptyDraft: MemberDraft = {
  name: "",
  knoxId: "",
  department: "",
  contact: "",
  joinDate: new Date().toISOString().slice(0, 10),
  grade: "정회원",
  role: "일반",
  note: ""
};

export function MembersView({ members, currentMember, onMembersChange, onSystemMessage }: MembersViewProps) {
  const isAdmin = currentMember.role === "admin";
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MemberDraft>(emptyDraft);
  const [password, setPassword] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<PublicMember | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const update = <Key extends keyof MemberDraft>(key: Key, value: MemberDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const openAddForm = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setPassword("");
    setIsFormOpen(true);
  };

  const openEditForm = (member: PublicMember) => {
    setEditingId(member.id);
    setDraft({
      name: member.name,
      knoxId: member.knoxId,
      department: member.department,
      contact: member.contact,
      joinDate: member.joinDate,
      grade: member.grade,
      role: member.role,
      note: member.note ?? ""
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!draft.name.trim() || !draft.knoxId.trim()) {
      onSystemMessage("이름과 Knox ID는 필수입니다.");
      return;
    }

    if (editingId) {
      const nextMembers = await updateMember({ ...draft, id: editingId });
      onMembersChange(nextMembers);
      onSystemMessage(`${draft.name} 회원 정보를 수정했습니다.`);
    } else {
      const nextMembers = await addMember(draft, password);
      onMembersChange(nextMembers);
      onSystemMessage(`${draft.name} 회원을 추가했습니다.`);
    }

    setIsFormOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteCandidate) {
      return;
    }

    const nextMembers = await removeMember(deleteCandidate.id);
    onMembersChange(nextMembers);
    onSystemMessage(`${deleteCandidate.name} 회원을 삭제했습니다.`);
    setDeleteCandidate(null);
  };

  const handleExport = () => {
    downloadMembersJson(members);
    onSystemMessage("회원 목록을 JSON으로 내보냈습니다.");
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const rows = parseMembersJson(text);

    if (rows.length === 0) {
      onSystemMessage("불러올 회원 데이터가 없습니다. (JSON 형식을 확인해 주세요)");
      return;
    }

    const nextMembers = await importMembers(rows);
    onMembersChange(nextMembers);
    onSystemMessage(`${rows.length}명의 회원을 불러왔습니다. (초기 비밀번호: Knox ID)`);
  };

  return (
    <div>
      <div className="view-header">
        <h1>회원 관리</h1>
        {isAdmin && (
          <div className="form-actions">
            <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()} type="button">
              불러오기
            </button>
            <input
              accept=".json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImportFile(file);
                }
                event.target.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />
            <button className="btn btn-sm" onClick={handleExport} type="button">
              내보내기
            </button>
            <button className="btn btn-primary btn-sm" onClick={openAddForm} type="button">
              추가
            </button>
          </div>
        )}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>Knox ID</th>
            <th>부서</th>
            <th>연락처</th>
            <th>가입 날짜</th>
            <th>회원 등급</th>
            <th>역할</th>
            <th>비고</th>
            {isAdmin && <th />}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>{member.name}</td>
              <td>{member.knoxId}</td>
              <td>{member.department}</td>
              <td>{member.contact}</td>
              <td>{member.joinDate}</td>
              <td>{member.grade}</td>
              <td>{member.role}</td>
              <td>{member.note}</td>
              {isAdmin && (
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEditForm(member)} type="button">
                    수정
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDeleteCandidate(member)} type="button">
                    삭제
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? "회원 정보 수정" : "회원 추가"}</h2>
            </div>
            <div className="form-grid">
              <div className="form-row">
                <div className="form-field">
                  <label>이름</label>
                  <input onChange={(event) => update("name", event.target.value)} value={draft.name} />
                </div>
                <div className="form-field">
                  <label>Knox ID</label>
                  <input onChange={(event) => update("knoxId", event.target.value)} value={draft.knoxId} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>부서</label>
                  <input onChange={(event) => update("department", event.target.value)} value={draft.department} />
                </div>
                <div className="form-field">
                  <label>연락처</label>
                  <input onChange={(event) => update("contact", event.target.value)} value={draft.contact} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>가입 날짜</label>
                  <input
                    onChange={(event) => update("joinDate", event.target.value)}
                    type="date"
                    value={draft.joinDate}
                  />
                </div>
                <div className="form-field">
                  <label>회원 등급</label>
                  <select onChange={(event) => update("grade", event.target.value as MemberGrade)} value={draft.grade}>
                    <option value="회장">회장</option>
                    <option value="총무">총무</option>
                    <option value="감사">감사</option>
                    <option value="정회원">정회원</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>역할</label>
                  <select onChange={(event) => update("role", event.target.value as MemberRole)} value={draft.role}>
                    <option value="일반">일반</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                {!editingId && (
                  <div className="form-field">
                    <label>초기 비밀번호 (비워두면 Knox ID로 설정)</label>
                    <input onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
                  </div>
                )}
              </div>
              <div className="form-field">
                <label>비고</label>
                <input onChange={(event) => update("note", event.target.value)} value={draft.note} />
              </div>
              <div className="form-actions">
                <button className="btn" onClick={() => setIsFormOpen(false)} type="button">
                  취소
                </button>
                <button className="btn btn-primary" onClick={handleSubmit} type="button">
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate && (
        <div className="modal-overlay" onClick={() => setDeleteCandidate(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()} style={{ width: 360 }}>
            <p>{deleteCandidate.name} 회원을 삭제하시겠습니까?</p>
            <div className="form-actions">
              <button className="btn" onClick={() => setDeleteCandidate(null)} type="button">
                취소
              </button>
              <button className="btn btn-danger" onClick={handleDelete} type="button">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
