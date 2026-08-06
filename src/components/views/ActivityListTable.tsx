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
}

export function ActivityListTable({ activities, onOpenActivity }: ActivityListTableProps) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>날짜</th>
          <th>제목</th>
          <th>참석자 수</th>
          <th>상태</th>
        </tr>
      </thead>
      <tbody>
        {activities.map((activity) => (
          <tr key={activity.id} onClick={() => onOpenActivity(activity.id)}>
            <td>{activity.date}</td>
            <td>{activity.title || "제목 없음"}</td>
            <td>{activity.attendeeIds.length}명</td>
            <td>
              <StatusBadge date={activity.date} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
