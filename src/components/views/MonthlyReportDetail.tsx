import { useMemo, useState } from "react";
import { exportMonthlyReportExcel } from "../../data/activitiesStore";
import { toDisplayableFileUrl } from "../../utils/fileUrl";
import type { Activity, AppSettings, ExpenseItem, PublicMember, ReceiptItem } from "../../types/domain";

interface MonthlyReportDetailProps {
  yyyyMm: string;
  activities: Activity[];
  members: PublicMember[];
  settings: AppSettings;
  onClose: () => void;
  onExported: (yyyyMm: string, filePath: string) => void;
  onSystemMessage: (message: string) => void;
}

interface AttendanceRow {
  member: PublicMember;
  marks: boolean[];
  attendedCount: number;
  sponsorship: number;
}

// A single attendance in the month earns `sponsorshipSingleAttendance`; two or more earn
// `sponsorshipMultipleAttendance` - both configured in Settings.
function calculateSponsorship(attendedCount: number, settings: AppSettings) {
  if (attendedCount <= 0) {
    return 0;
  }

  return attendedCount === 1 ? settings.sponsorshipSingleAttendance : settings.sponsorshipMultipleAttendance;
}

function formatWon(amount: number) {
  return `${amount.toLocaleString()}원`;
}

const MEDIA_SECTIONS: Array<{ field: "photoFileNames" | "receiptFileNames" | "expenseFileNames"; title: string }> = [
  { field: "photoFileNames", title: "사진" },
  { field: "receiptFileNames", title: "영수증 사진" },
  { field: "expenseFileNames", title: "경비 사진" }
];

function MonthlyLineItemTable({ title, rows }: { title: string; rows: Array<ReceiptItem | ExpenseItem> }) {
  const total = rows.reduce((sum, row) => sum + row.price, 0);

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="view-header">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="thumbnail-empty">등록된 내역이 없습니다.</p>
      ) : (
        <table className="data-table monthly-line-item-table">
          <thead>
            <tr>
              <th className="monthly-line-item-number-cell">번호</th>
              <th>날짜</th>
              <th>구매 내용</th>
              <th className="monthly-line-item-price-cell">가격</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td className="monthly-line-item-number-cell">{index + 1}</td>
                <td>{row.date}</td>
                <td>{row.item}</td>
                <td className="monthly-line-item-price-cell">{formatWon(row.price)}</td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="data-table-footer">
                합계
              </td>
              <td className="data-table-footer monthly-line-item-price-cell" colSpan={2}>
                {formatWon(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

export function MonthlyReportDetail({
  yyyyMm,
  activities,
  members,
  settings,
  onClose,
  onExported,
  onSystemMessage
}: MonthlyReportDetailProps) {
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    setIsExporting(true);

    try {
      const result = await exportMonthlyReportExcel(yyyyMm);

      if (result.ok) {
        if (result.path) {
          onExported(yyyyMm, result.path);
        }

        onSystemMessage(result.path ? `엑셀 파일로 내보냈습니다: ${result.path}` : "엑셀 파일로 내보냈습니다.");
      } else if (result.error) {
        onSystemMessage(result.error);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const monthActivities = useMemo(
    () =>
      activities
        .filter((activity) => activity.date.startsWith(yyyyMm))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [activities, yyyyMm]
  );

  // Everyone active, plus any withdrawn (soft-deleted) member who actually attended something
  // this month - so a since-deleted member's historical attendance still shows up, without
  // permanently cluttering every future month's roster with people who never attended it.
  const relevantMembers = useMemo(() => {
    const active = members.filter((member) => !member.withdrawn);
    const withdrawnButAttended = members.filter(
      (member) => member.withdrawn && monthActivities.some((activity) => activity.attendeeIds.includes(member.id))
    );

    return [...active, ...withdrawnButAttended];
  }, [members, monthActivities]);

  const attendanceRows = useMemo<AttendanceRow[]>(() => {
    return relevantMembers
      .map((member) => {
        const marks = monthActivities.map((activity) => activity.attendeeIds.includes(member.id));
        const attendedCount = marks.filter(Boolean).length;

        return { member, marks, attendedCount, sponsorship: calculateSponsorship(attendedCount, settings) };
      })
      .sort((a, b) => {
        if (a.member.role !== b.member.role) {
          return a.member.role === "admin" ? -1 : 1;
        }

        return a.member.name.localeCompare(b.member.name, "ko");
      });
  }, [relevantMembers, monthActivities, settings]);

  const attendedRows = attendanceRows.filter((row) => row.attendedCount > 0);
  const totalHeadcount = attendedRows.length;
  const totalSponsorship = attendedRows.reduce((sum, row) => sum + row.sponsorship, 0);

  const allReceipts = useMemo(() => monthActivities.flatMap((activity) => activity.receipts), [monthActivities]);
  const allExpenses = useMemo(() => monthActivities.flatMap((activity) => activity.expenses), [monthActivities]);

  return (
    <div>
      <div className="view-header">
        <h1>{yyyyMm.slice(2)} 월간 정리</h1>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={isExporting} onClick={handleExportExcel} type="button">
            {isExporting ? "내보내는 중..." : "Excel로 내보내기"}
          </button>
          <button className="btn btn-primary" onClick={onClose} type="button">
            닫기
          </button>
        </div>
      </div>

      {monthActivities.length === 0 ? (
        <p className="empty-state">해당 월에 등록된 활동이 없습니다.</p>
      ) : (
        <>
          <div className="summary-2x2 monthly-detail-summary">
            <div>
              <div className="summary-label">이달의 활동 수</div>
              <div className="summary-value">{monthActivities.length}건</div>
            </div>
            <div>
              <div className="summary-label">참석 인원(총원)</div>
              <div className="summary-value">{totalHeadcount}명</div>
            </div>
          </div>

          <table className="data-table monthly-attendance-table">
            <thead>
              <tr>
                <th className="monthly-attendance-center-cell">번호</th>
                <th>이름</th>
                <th>Knox ID</th>
                {monthActivities.map((activity, index) => (
                  <th className="monthly-attendance-center-cell" key={activity.id}>
                    {index + 1}차
                    <br />
                    <span>{activity.date.slice(5)}</span>
                  </th>
                ))}
                <th className="monthly-attendance-center-cell">합</th>
                <th className="monthly-attendance-money-cell">후원금액</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRows.map((row, index) => (
                <tr key={row.member.id}>
                  <td className="monthly-attendance-center-cell">{index + 1}</td>
                  <td>{row.member.name}</td>
                  <td>{row.member.knoxId}</td>
                  {row.marks.map((attended, markIndex) => (
                    <td className="monthly-attendance-center-cell" key={markIndex}>
                      {attended ? "○" : ""}
                    </td>
                  ))}
                  <td className="monthly-attendance-center-cell">{row.attendedCount}</td>
                  <td className="monthly-attendance-money-cell">{formatWon(row.sponsorship)}</td>
                  <td>{row.member.withdrawn ? "탈퇴" : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="data-table-footer" colSpan={4 + monthActivities.length}>
                  총원 {totalHeadcount}명
                </td>
                <td className="data-table-footer monthly-attendance-money-cell">{formatWon(totalSponsorship)}</td>
                <td className="data-table-footer" />
              </tr>
            </tfoot>
          </table>

          {MEDIA_SECTIONS.map(({ field, title }) => {
            const groups = monthActivities
              .map((activity, index) => ({ activity, index, files: activity[field] }))
              .filter((group) => group.files.length > 0);

            return (
              <div className="card" key={field} style={{ marginTop: 24 }}>
                <div className="view-header">
                  <h2>{title}</h2>
                </div>
                {groups.length === 0 ? (
                  <p className="thumbnail-empty">등록된 {title}이 없습니다.</p>
                ) : (
                  groups.map(({ activity, index, files }) => (
                    <div key={activity.id} style={{ marginBottom: 16 }}>
                      <div className="view-subtitle" style={{ marginBottom: 8 }}>
                        {index + 1}차 ({activity.date}) {activity.title || "제목 없음"}
                      </div>
                      <div className="thumbnail-grid">
                        {files.map((url) => (
                          <img
                            alt=""
                            className="thumbnail"
                            key={url}
                            onClick={() => setPreviewImageUrl(url)}
                            src={toDisplayableFileUrl(url)}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}

          <MonthlyLineItemTable rows={allReceipts} title="영수증 내역" />
          <MonthlyLineItemTable rows={allExpenses} title="경비 내역" />
        </>
      )}

      {previewImageUrl && (
        <div className="image-preview-overlay" onClick={() => setPreviewImageUrl(null)}>
          <img alt="" className="image-preview-content" src={toDisplayableFileUrl(previewImageUrl)} />
        </div>
      )}
    </div>
  );
}
