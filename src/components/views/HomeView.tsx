import { useMemo, useState } from "react";
import { formatYyMm, getActivityStatus } from "../../data/activitiesStore";
import { toDisplayableFileUrl } from "../../utils/fileUrl";
import type { Activity, AppSettings, PublicMember } from "../../types/domain";
import type { ViewMode } from "../../App";

function ClubLogo({ clubName, logoPath }: { clubName: string; logoPath: string }) {
  const [failed, setFailed] = useState(false);

  if (!logoPath || failed) {
    return <div className="club-logo club-logo-placeholder">No Logo</div>;
  }

  return (
    <div className="club-logo">
      <img alt={clubName} className="club-logo-image" onError={() => setFailed(true)} src={toDisplayableFileUrl(logoPath)} />
    </div>
  );
}

interface HomeViewProps {
  settings: AppSettings;
  members: PublicMember[];
  activities: Activity[];
  onOpenActivity: (activityId: string) => void;
  onNavigate: (view: ViewMode) => void;
}

function ActivityListCard({
  title,
  activities,
  onOpenActivity
}: {
  title: string;
  activities: Activity[];
  onOpenActivity: (activityId: string) => void;
}) {
  return (
    <div className="card summary-card">
      <h2>{title}</h2>

      {activities.length === 0 ? (
        <p className="summary-card-empty">등록된 활동이 없습니다.</p>
      ) : (
        activities.map((activity) => (
          <div className="activity-row" key={activity.id} onClick={() => onOpenActivity(activity.id)}>
            <span className="date-badge">{formatYyMm(activity.date)}</span>
            <div className="activity-row-content">
              <span className="activity-title-line">
                <span className="activity-row-title activity-title-text">{activity.title || "제목 없음"}</span>
                <span className="activity-row-meta">{activity.weekOfMonth}주차</span>
              </span>
            </div>
            <span className="activity-row-attendees">{activity.attendeeIds.length}명</span>
          </div>
        ))
      )}
    </div>
  );
}

export function HomeView({ settings, members, activities, onOpenActivity, onNavigate }: HomeViewProps) {
  const { completedThisYear, participantCountThisYear, completedActivities, upcomingActivities } = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const sortedByDateDesc = [...activities].sort((a, b) => b.date.localeCompare(a.date));
    const sortedByDateAsc = [...activities].sort((a, b) => a.date.localeCompare(b.date));
    const completed = sortedByDateDesc.filter((activity) => getActivityStatus(activity.date) === "완료");
    const upcoming = sortedByDateAsc.filter((activity) => getActivityStatus(activity.date) === "예정");
    const completedInYear = completed.filter((activity) => activity.date.startsWith(String(currentYear)));

    return {
      completedThisYear: completedInYear.length,
      participantCountThisYear: completedInYear.reduce((total, activity) => total + activity.attendeeIds.length, 0),
      completedActivities: completed.slice(0, 5),
      upcomingActivities: upcoming.slice(0, 5)
    };
  }, [activities]);

  return (
    <div>
      <div className="home-header card">
        <ClubLogo clubName={settings.clubName} key={settings.clubLogoPath} logoPath={settings.clubLogoPath} />
        <div>
          <h1>{settings.clubName}</h1>
          <p>{settings.clubIntro}</p>
        </div>
      </div>

      <div className="stat-card-grid">
        <button className="card stat-card stat-card-clickable" onClick={() => onNavigate("members")} type="button">
          <span className="stat-label">총 회원수</span>
          <span className="stat-value">{members.length}</span>
        </button>
        <button className="card stat-card stat-card-clickable" onClick={() => onNavigate("activities")} type="button">
          <span className="stat-label">올해 시행한 모임의 수</span>
          <span className="stat-value">{completedThisYear}</span>
        </button>
        <button className="card stat-card stat-card-clickable" onClick={() => onNavigate("activities")} type="button">
          <span className="stat-label">참가한 사람들의 수</span>
          <span className="stat-value">{participantCountThisYear}</span>
        </button>
      </div>

      <div className="summary-card-grid">
        <ActivityListCard activities={completedActivities} onOpenActivity={onOpenActivity} title="완료된 행사" />
        <ActivityListCard activities={upcomingActivities} onOpenActivity={onOpenActivity} title="예정된 행사" />
      </div>
    </div>
  );
}
