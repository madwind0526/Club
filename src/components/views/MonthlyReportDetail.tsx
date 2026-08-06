import { useMemo, useState } from "react";
import type { Activity, ExpenseItem, PublicMember, ReceiptItem } from "../../types/domain";

interface MonthlyReportDetailProps {
  yyyyMm: string;
  activities: Activity[];
  members: PublicMember[];
  onClose: () => void;
}

interface AttendanceRow {
  member: PublicMember;
  marks: boolean[];
  attendedCount: number;
  sponsorship: number;
}

// A single attendance in the month earns 50,000; two or more earn 100,000.
function calculateSponsorship(attendedCount: number) {
  if (attendedCount <= 0) {
    return 0;
  }

  return attendedCount === 1 ? 50000 : 100000;
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
        <table className="data-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>구매 내용</th>
              <th>가격</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.date}</td>
                <td>{row.item}</td>
                <td>{formatWon(row.price)}</td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="data-table-footer">
                합계
              </td>
              <td className="data-table-footer" colSpan={2}>
                {formatWon(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

export function MonthlyReportDetail({ yyyyMm, activities, members, onClose }: MonthlyReportDetailProps) {
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const monthActivities = useMemo(
    () =>
      activities
        .filter((activity) => activity.date.startsWith(yyyyMm))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [activities, yyyyMm]
  );

  const attendanceRows = useMemo<AttendanceRow[]>(() => {
    return members
      .map((member) => {
        const marks = monthActivities.map((activity) => activity.attendeeIds.includes(member.id));
        const attendedCount = marks.filter(Boolean).length;

        return { member, marks, attendedCount, sponsorship: calculateSponsorship(attendedCount) };
      })
      .filter((row) => row.attendedCount > 0)
      .sort((a, b) => b.attendedCount - a.attendedCount);
  }, [members, monthActivities]);

  const totalHeadcount = attendanceRows.length;
  const totalSponsorship = attendanceRows.reduce((sum, row) => sum + row.sponsorship, 0);

  const allReceipts = useMemo(() => monthActivities.flatMap((activity) => activity.receipts), [monthActivities]);
  const allExpenses = useMemo(() => monthActivities.flatMap((activity) => activity.expenses), [monthActivities]);

  return (
    <div>
      <div className="view-header">
        <h1>{yyyyMm.slice(2)} 월간 정리</h1>
        <button className="btn" onClick={onClose} type="button">
          닫기
        </button>
      </div>

      {monthActivities.length === 0 ? (
        <p className="empty-state">해당 월에 등록된 활동이 없습니다.</p>
      ) : (
        <>
          <div className="summary-2x2">
            <div>
              <div className="summary-label">이달의 활동 수</div>
              <div className="summary-value">{monthActivities.length}건</div>
            </div>
            <div>
              <div className="summary-label">참석 인원(총원)</div>
              <div className="summary-value">{totalHeadcount}명</div>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>번호</th>
                <th>이름</th>
                <th>Knox ID</th>
                {monthActivities.map((activity, index) => (
                  <th key={activity.id}>
                    {index + 1}차
                    <br />
                    <span style={{ fontWeight: 400 }}>{activity.date.slice(5)}</span>
                  </th>
                ))}
                <th>합</th>
                <th>후원금액</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRows.map((row, index) => (
                <tr key={row.member.id}>
                  <td>{index + 1}</td>
                  <td>{row.member.name}</td>
                  <td>{row.member.knoxId}</td>
                  {row.marks.map((attended, markIndex) => (
                    <td key={markIndex} style={{ textAlign: "center" }}>
                      {attended ? "○" : ""}
                    </td>
                  ))}
                  <td>{row.attendedCount}</td>
                  <td>{formatWon(row.sponsorship)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="data-table-footer" colSpan={4 + monthActivities.length}>
                  총원 {totalHeadcount}명
                </td>
                <td className="data-table-footer">{formatWon(totalSponsorship)}</td>
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
                          <img alt="" className="thumbnail" key={url} onClick={() => setPreviewImageUrl(url)} src={url} />
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
          <img alt="" className="image-preview-content" src={previewImageUrl} />
        </div>
      )}
    </div>
  );
}
