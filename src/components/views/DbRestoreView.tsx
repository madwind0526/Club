import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { listDatabaseBackups, restoreDatabaseBackup } from "../../data/dbBackupStore";
import type { DatabaseBackupInfo } from "../../types/domain";

interface DbRestoreViewProps {
  onSystemMessage: (message: string) => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes}B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)}${units[unitIndex]}`;
}

function formatDateTime(iso: string) {
  return iso.slice(0, 16).replace("T", " ");
}

export function DbRestoreView({ onSystemMessage }: DbRestoreViewProps) {
  const [backups, setBackups] = useState<DatabaseBackupInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<DatabaseBackupInfo | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const load = async () => {
    setIsLoading(true);

    try {
      setBackups(await listDatabaseBackups());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRestore = async () => {
    if (!confirmTarget) {
      return;
    }

    setIsRestoring(true);

    try {
      const result = await restoreDatabaseBackup(confirmTarget.name);

      if (result.ok) {
        onSystemMessage("DB를 복원했습니다. 앱을 다시 불러옵니다...");
        window.location.reload();
        return;
      }

      onSystemMessage(result.error ?? "DB 복원에 실패했습니다.");
    } finally {
      setIsRestoring(false);
      setConfirmTarget(null);
    }
  };

  return (
    <div>
      <div className="view-header">
        <h1>DB 복원</h1>
        <span className="view-subtitle">총 {backups.length}개</span>
      </div>

      {isLoading ? (
        <p className="empty-state">불러오는 중...</p>
      ) : backups.length === 0 ? (
        <p className="empty-state">저장된 백업이 없습니다. "DB 백업" 메뉴로 먼저 백업을 만들어 주세요.</p>
      ) : (
        <table className="data-table db-backup-table">
          <colgroup>
            <col />
            <col style={{ width: 100 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 70 }} />
          </colgroup>
          <thead>
            <tr>
              <th>파일명</th>
              <th className="db-backup-center-cell">크기</th>
              <th className="db-backup-center-cell">생성 시각</th>
              <th className="db-backup-center-cell">복원</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((backup) => (
              <tr key={backup.name}>
                <td>{backup.name}</td>
                <td className="db-backup-center-cell">{formatFileSize(backup.size)}</td>
                <td className="db-backup-center-cell">{formatDateTime(backup.modifiedAt)}</td>
                <td className="db-backup-center-cell">
                  <button className="icon-btn" onClick={() => setConfirmTarget(backup)} title="이 백업으로 복원" type="button">
                    <RotateCcw size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {confirmTarget && (
        <div className="modal-overlay" onClick={() => !isRestoring && setConfirmTarget(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()} style={{ width: 420 }}>
            <p>
              "{confirmTarget.name}" 백업으로 복원하시겠습니까?
              <br />
              현재 저장된 모든 데이터(활동/회원/게시판/설정/사진 등)가 삭제되고 백업 시점으로 되돌아갑니다. 이 작업은
              되돌릴 수 없습니다.
            </p>
            <div className="form-actions">
              <button className="btn" disabled={isRestoring} onClick={() => setConfirmTarget(null)} type="button">
                취소
              </button>
              <button className="btn btn-danger" disabled={isRestoring} onClick={() => void handleRestore()} type="button">
                {isRestoring ? "복원 중..." : "복원"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
