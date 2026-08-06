import { useMemo } from "react";
import { formatYyyyMm } from "../../data/activitiesStore";
import type { Activity } from "../../types/domain";

interface MonthSummary {
  yyyyMm: string;
  activityCount: number;
  totalAttendance: number;
}

interface MonthlyReportViewProps {
  activities: Activity[];
  onOpenMonth: (yyyyMm: string) => void;
}

export function MonthlyReportView({ activities, onOpenMonth }: MonthlyReportViewProps) {
  const months = useMemo<MonthSummary[]>(() => {
    const summaries = new Map<string, MonthSummary>();

    activities.forEach((activity) => {
      const yyyyMm = formatYyyyMm(activity.date);
      const current = summaries.get(yyyyMm) ?? { yyyyMm, activityCount: 0, totalAttendance: 0 };

      current.activityCount += 1;
      current.totalAttendance += activity.attendeeIds.length;
      summaries.set(yyyyMm, current);
    });

    return Array.from(summaries.values()).sort((a, b) => b.yyyyMm.localeCompare(a.yyyyMm));
  }, [activities]);

  return (
    <div>
      <div className="view-header">
        <h1>월간 정리</h1>
        <span className="view-subtitle">총 {months.length}개월</span>
      </div>

      {months.length === 0 ? (
        <p className="empty-state">등록된 활동이 없습니다.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>월</th>
              <th>활동 수</th>
              <th>총 참석 인원</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.yyyyMm} onClick={() => onOpenMonth(month.yyyyMm)}>
                <td>{month.yyyyMm}</td>
                <td>{month.activityCount}건</td>
                <td>{month.totalAttendance}명</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
