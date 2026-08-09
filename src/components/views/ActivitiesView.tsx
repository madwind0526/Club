import { useMemo } from "react";
import { formatYyMm } from "../../data/activitiesStore";
import { ActivityListTable, StatusBadge } from "./ActivityListTable";
import type { Activity } from "../../types/domain";
import type { ActivitiesViewMode } from "../../App";

interface ActivitiesViewProps {
  activities: Activity[];
  viewMode: ActivitiesViewMode;
  query: string;
  onOpenActivity: (activityId: string) => void;
}

export function ActivitiesView({ activities, viewMode, query, onOpenActivity }: ActivitiesViewProps) {
  const filteredActivities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sorted = [...activities].sort((a, b) => b.date.localeCompare(a.date));

    if (!normalizedQuery) {
      return sorted;
    }

    return sorted.filter((activity) =>
      `${activity.title} ${activity.content}`.toLowerCase().includes(normalizedQuery)
    );
  }, [activities, query]);

  return (
    <div>
      <div className="view-header">
        <h1>Activities</h1>
        <span className="view-subtitle">총 {filteredActivities.length}건</span>
      </div>

      {filteredActivities.length === 0 ? (
        <p className="empty-state">검색 결과가 없습니다.</p>
      ) : viewMode === "photo" ? (
        <div className="photo-grid">
          {filteredActivities.map((activity) => (
            <div className="photo-tile" key={activity.id} onClick={() => onOpenActivity(activity.id)}>
              {activity.photoFileNames[0] ? (
                <img alt={activity.title} src={activity.photoFileNames[0]} />
              ) : (
                <div className="club-logo-placeholder" style={{ width: "100%", height: "100%", display: "grid" }}>
                  No Photo
                </div>
              )}
              <div className="photo-tile-caption">
                <div>{activity.title || "제목 없음"}</div>
                <div style={{ opacity: 0.8, fontSize: "0.72rem", marginTop: 2 }}>{activity.weekOfMonth}주차</div>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "card" ? (
        <div className="card-grid">
          {filteredActivities.map((activity) => (
            <div className="card activity-card" key={activity.id} onClick={() => onOpenActivity(activity.id)}>
              <div className="activity-card-badges">
                <span className="date-badge">{formatYyMm(activity.date)}</span>
                <StatusBadge date={activity.date} />
              </div>
              <h3>{activity.title || "제목 없음"}</h3>
              <span className="activity-row-meta">{activity.weekOfMonth}주차</span>
              <p>{activity.content || "내용 없음"}</p>
              <span className="activity-row-meta">참석자 {activity.attendeeIds.length}명</span>
            </div>
          ))}
        </div>
      ) : (
        <ActivityListTable activities={filteredActivities} onOpenActivity={onOpenActivity} />
      )}
    </div>
  );
}
