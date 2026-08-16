import { Trash2 } from "lucide-react";
import { useState } from "react";
import { getActivityStatus } from "../../data/activitiesStore";
import type { Activity } from "../../types/domain";

export function StatusBadge({ date }: { date: string }) {
  const status = getActivityStatus(date);

  return (
    <span className={status === "예정" ? "badge badge-status-upcoming" : "badge badge-status-completed"}>
      {status}
    </span>
  );
}

interface ActivityListTableProps {
  activities: Activity[];
  onOpenActivity: (activityId: string) => void;
  // Omitted entirely (not just disabled) for non-admin viewers - the 삭제 column only renders
  // when this is provided.
  onDelete?: (activityId: string) => void;
}

export function ActivityListTable({ activities, onOpenActivity, onDelete }: ActivityListTableProps) {
  const [deleteCandidate, setDeleteCandidate] = useState<Activity | null>(null);

  const handleConfirmDelete = () => {
    if (deleteCandidate) {
      onDelete?.(deleteCandidate.id);
      setDeleteCandidate(null);
    }
  };

  return (
    <>
      <table className="data-table">
        <colgroup>
          <col style={{ width: 100 }} />
          <col />
          <col style={{ width: 90 }} />
          <col style={{ width: 70 }} />
          {onDelete && <col style={{ width: 50 }} />}
        </colgroup>
        <thead>
          <tr>
            <th>날짜</th>
            <th>제목</th>
            <th>참석자 수</th>
            <th>상태</th>
            {onDelete && <th>삭제</th>}
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => (
            <tr key={activity.id} onClick={() => onOpenActivity(activity.id)}>
              <td>{activity.date}</td>
              <td>
                {activity.title || "제목 없음"}
                <div className="activity-row-meta">{activity.weekOfMonth}주차</div>
              </td>
              <td>{activity.attendeeIds.length}명</td>
              <td>
                <StatusBadge date={activity.date} />
              </td>
              {onDelete && (
                <td>
                  <button
                    className="icon-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteCandidate(activity);
                    }}
                    title="활동 삭제"
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {deleteCandidate && (
        <div className="modal-overlay" onClick={() => setDeleteCandidate(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()} style={{ width: 360 }}>
            <p>"{deleteCandidate.title || "제목 없음"}" 활동을 삭제하시겠습니까?</p>
            <div className="form-actions">
              <button className="btn" onClick={() => setDeleteCandidate(null)} type="button">
                취소
              </button>
              <button className="btn btn-danger" onClick={handleConfirmDelete} type="button">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
