import type { PublicMember } from "../../types/domain";

interface ProfileViewProps {
  member: PublicMember;
  onLogout: () => void;
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

export function ProfileView({ member, onLogout }: ProfileViewProps) {
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
          <button className="btn btn-danger" onClick={onLogout} type="button">
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
