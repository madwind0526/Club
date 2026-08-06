import { useMemo } from "react";
import { ActivityListTable } from "./ActivityListTable";
import type { Activity } from "../../types/domain";

interface WeeklyReportViewProps {
  activities: Activity[];
  onOpenActivity: (activityId: string) => void;
}

export function WeeklyReportView({ activities, onOpenActivity }: WeeklyReportViewProps) {
  const sortedActivities = useMemo(() => [...activities].sort((a, b) => b.date.localeCompare(a.date)), [activities]);

  return (
    <div>
      <div className="view-header">
        <h1>주간 정리</h1>
        <span className="view-subtitle">총 {sortedActivities.length}건</span>
      </div>

      {sortedActivities.length === 0 ? (
        <p className="empty-state">등록된 활동이 없습니다.</p>
      ) : (
        <ActivityListTable activities={sortedActivities} onOpenActivity={onOpenActivity} />
      )}
    </div>
  );
}
