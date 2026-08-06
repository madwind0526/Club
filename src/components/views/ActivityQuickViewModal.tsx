import { getActivityStatus } from "../../data/activitiesStore";
import type { Activity, PublicMember } from "../../types/domain";

interface ActivityQuickViewModalProps {
  activity: Activity;
  currentMember: PublicMember;
  onClose: () => void;
  onToggleAttendance: () => void;
  onOpenReport: () => void;
}

export function ActivityQuickViewModal({
  activity,
  currentMember,
  onClose,
  onToggleAttendance,
  onOpenReport
}: ActivityQuickViewModalProps) {
  const status = getActivityStatus(activity.date);
  const isCompleted = status === "완료";
  const isAttending = activity.attendeeIds.includes(currentMember.id);
  const isAdmin = currentMember.role === "admin";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()} style={{ width: 480 }}>
        <div className="modal-header">
          <div>
            <span className={isCompleted ? "badge badge-status-completed" : "badge badge-status-upcoming"}>
              {status}
            </span>
            <h2 style={{ marginTop: 8 }}>{activity.title || "제목 없음"}</h2>
            <span className="view-subtitle">
              {activity.date} · {activity.weekOfMonth}주차 · 참석자 {activity.attendeeIds.length}명
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} type="button">
            닫기
          </button>
        </div>

        <p style={{ whiteSpace: "pre-wrap" }}>{activity.content || "내용이 없습니다."}</p>

        <div className="form-actions">
          {isCompleted ? (
            <button className="btn btn-primary" onClick={onOpenReport} type="button">
              상세 내역 확인
            </button>
          ) : (
            <>
              <button
                className={isAttending ? "btn btn-danger" : "btn btn-primary"}
                onClick={onToggleAttendance}
                type="button"
              >
                {isAttending ? "참가 취소" : "참가 신청"}
              </button>
              {isAdmin && (
                <button className="btn" onClick={onOpenReport} type="button">
                  활동등록
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
