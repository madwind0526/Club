import { useState } from "react";
import { updateMember } from "../../data/membersStore";
import type { PublicMember } from "../../types/domain";

interface ProfileViewProps {
  member: PublicMember;
  onLogout: () => void;
  onMembersChange: (members: PublicMember[]) => void;
  onSystemMessage: (message: string) => void;
}

const fieldLabels: Array<[keyof PublicMember, string]> = [
  ["name", "이름"],
  ["knoxId", "Knox ID"],
  ["department", "부서"],
  ["contact", "연락처"],
  ["joinDate", "가입 날짜"],
  ["grade", "회원 등급"],
  ["role", "역할"],
  ["note", "비고"]
];

export function ProfileView({ member, onLogout, onMembersChange, onSystemMessage }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [department, setDepartment] = useState(member.department);
  const [note, setNote] = useState(member.note ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const openEdit = () => {
    setName(member.name);
    setDepartment(member.department);
    setNote(member.note ?? "");
    setNewPassword("");
    setConfirmPassword("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      onSystemMessage("이름을 입력해 주세요.");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      onSystemMessage("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsSaving(true);

    try {
      const nextMembers = await updateMember({
        ...member,
        name: name.trim(),
        department,
        note,
        ...(newPassword ? { newPassword } : {})
      });

      onMembersChange(nextMembers);
      setIsEditing(false);
      onSystemMessage(newPassword ? "프로필과 비밀번호를 수정했습니다." : "프로필을 수정했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="view-header">
        <h1>User Profile</h1>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <table className="data-table">
          <tbody>
            {fieldLabels.map(([key, label]) => (
              <tr key={key}>
                <th style={{ width: 110 }}>{label}</th>
                <td>{member[key] || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="form-actions">
          <button className="btn" onClick={openEdit} type="button">
            수정
          </button>
          <button className="btn btn-danger" onClick={onLogout} type="button">
            로그아웃
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>프로필 수정</h2>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="profile-name">이름</label>
                <input id="profile-name" onChange={(event) => setName(event.target.value)} value={name} />
              </div>
              <div className="form-field">
                <label htmlFor="profile-department">부서</label>
                <input
                  id="profile-department"
                  onChange={(event) => setDepartment(event.target.value)}
                  value={department}
                />
              </div>
              <div className="form-field">
                <label htmlFor="profile-note">비고</label>
                <input id="profile-note" onChange={(event) => setNote(event.target.value)} value={note} />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="profile-new-password">새 비밀번호 (변경하지 않으려면 비워두세요)</label>
                  <input
                    id="profile-new-password"
                    onChange={(event) => setNewPassword(event.target.value)}
                    type="password"
                    value={newPassword}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="profile-confirm-password">새 비밀번호 확인</label>
                  <input
                    id="profile-confirm-password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type="password"
                    value={confirmPassword}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn" onClick={() => setIsEditing(false)} type="button">
                  취소
                </button>
                <button className="btn btn-primary" disabled={isSaving} onClick={handleSave} type="button">
                  {isSaving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
