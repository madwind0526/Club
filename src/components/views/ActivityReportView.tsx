import { useState } from "react";
import { formatYyMm, formatYyyyMm } from "../../data/activitiesStore";
import { findPlanFile, pickFile, scanMediaFolder } from "../../data/mediaStore";
import type { Activity, ExpenseItem, PublicMember, ReceiptItem } from "../../types/domain";

interface ActivityReportViewProps {
  activity: Activity;
  members: PublicMember[];
  onSave: (activity: Activity) => void;
  onSystemMessage: (message: string) => void;
  onClose: () => void;
}

type MediaCategory = "Photos" | "Receipts" | "Expenses";
type MediaField = "photoFileNames" | "receiptFileNames" | "expenseFileNames";

function LineItemTable({
  rows,
  onChange
}: {
  rows: ReceiptItem[] | ExpenseItem[];
  onChange: (rows: ReceiptItem[]) => void;
}) {
  const updateRow = (id: string, patch: Partial<ReceiptItem>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    onChange([...rows, { id: `line-${Date.now()}`, date: "", item: "", price: 0, note: "" }]);
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((row) => row.id !== id));
  };

  return (
    <div>
      <table className="data-table">
        <thead>
          <tr>
            <th>날짜</th>
            <th>구매 내용</th>
            <th>가격</th>
            <th>비고</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <input onChange={(event) => updateRow(row.id, { date: event.target.value })} type="date" value={row.date} />
              </td>
              <td>
                <input onChange={(event) => updateRow(row.id, { item: event.target.value })} value={row.item} />
              </td>
              <td>
                <input
                  onChange={(event) => updateRow(row.id, { price: Number(event.target.value) || 0 })}
                  placeholder="0"
                  type="number"
                  value={row.price === 0 ? "" : row.price}
                />
              </td>
              <td>
                <input onChange={(event) => updateRow(row.id, { note: event.target.value })} value={row.note ?? ""} />
              </td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => removeRow(row.id)} type="button">
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn-sm" onClick={addRow} style={{ marginTop: 10 }} type="button">
        + 항목 추가
      </button>
    </div>
  );
}

function MediaSection({
  title,
  emptyMessage,
  files,
  isScanning,
  onScan,
  onRemove,
  onPreview
}: {
  title: string;
  emptyMessage: string;
  files: string[];
  isScanning: boolean;
  onScan: () => void;
  onRemove: (url: string) => void;
  onPreview: (url: string) => void;
}) {
  return (
    <>
      <div className="view-header">
        <h2>{title}</h2>
        <button className="btn btn-sm" disabled={isScanning} onClick={onScan} type="button">
          {isScanning ? "불러오는 중..." : "폴더에서 불러오기"}
        </button>
      </div>
      {files.length === 0 ? (
        <p className="thumbnail-empty">{emptyMessage}</p>
      ) : (
        <div className="thumbnail-grid">
          {files.map((url) => (
            <div className="thumbnail-item" key={url}>
              <img alt="" className="thumbnail" onClick={() => onPreview(url)} src={url} />
              <button className="thumbnail-delete" onClick={() => onRemove(url)} title="삭제" type="button">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function ActivityReportView({ activity, members, onSave, onSystemMessage, onClose }: ActivityReportViewProps) {
  const [draft, setDraft] = useState<Activity>(activity);
  const [isScanning, setIsScanning] = useState<MediaCategory | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [newAttendeeId, setNewAttendeeId] = useState("");
  const [isFindingPlanFile, setIsFindingPlanFile] = useState(false);

  const planFileName = draft.planFilePath ? draft.planFilePath.split(/[\\/]/).pop() : null;

  const attendeeRows = draft.attendeeIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is PublicMember => Boolean(member));

  const availableMembers = members.filter((member) => !draft.attendeeIds.includes(member.id));

  const addAttendee = () => {
    if (!newAttendeeId) {
      return;
    }

    setDraft((current) => ({ ...current, attendeeIds: [...current.attendeeIds, newAttendeeId] }));
    setNewAttendeeId("");
  };

  const removeAttendee = (memberId: string) => {
    setDraft((current) => ({ ...current, attendeeIds: current.attendeeIds.filter((id) => id !== memberId) }));
  };

  const removeMediaFile = (field: MediaField, url: string) => {
    setDraft((current) => ({ ...current, [field]: current[field].filter((item) => item !== url) }));
  };

  const handleScan = async (category: MediaCategory) => {
    setIsScanning(category);

    const field: MediaField =
      category === "Photos" ? "photoFileNames" : category === "Receipts" ? "receiptFileNames" : "expenseFileNames";

    try {
      const result = await scanMediaFolder(category, formatYyyyMm(draft.date), draft.weekOfMonth);

      // Merge rather than replace - individually deleted files must not silently reappear the
      // next time this folder is rescanned to pick up newly added ones.
      setDraft((current) => ({
        ...current,
        [field]: Array.from(new Set([...current[field], ...result.files]))
      }));

      onSystemMessage(
        result.files.length > 0
          ? `${result.folder} 에서 이미지 ${result.files.length}개를 불러왔습니다.`
          : `${category === "Photos" ? "사진" : category === "Receipts" ? "영수증" : "경비"} 폴더에 이미지가 없습니다. (데이터 루트 폴더 설정을 확인하세요)`
      );
    } finally {
      setIsScanning(null);
    }
  };

  const handleSave = () => {
    onSave(draft);
    onSystemMessage("활동 리포트를 저장했습니다.");
  };

  const handlePickPlanFile = async () => {
    const picked = await pickFile();

    if (picked) {
      setDraft((current) => ({ ...current, planFilePath: picked.path }));
      onSystemMessage(`활동 계획서를 첨부했습니다: ${picked.name}`);
    }
  };

  const handleAutoDetectPlanFile = async () => {
    setIsFindingPlanFile(true);

    try {
      const found = await findPlanFile(formatYyyyMm(draft.date), draft.weekOfMonth);

      if (found) {
        setDraft((current) => ({ ...current, planFilePath: found.path }));
        onSystemMessage(`계획서 파일을 자동으로 찾아 첨부했습니다: ${found.name}`);
      } else {
        onSystemMessage("일치하는 계획서 파일을 찾지 못했습니다. (Plan 폴더와 파일명을 확인해 주세요)");
      }
    } finally {
      setIsFindingPlanFile(false);
    }
  };

  return (
    <div>
      <div className="view-header">
        <h1>
          ({formatYyMm(draft.date)} {draft.weekOfMonth}주차 활동) {draft.title || "제목 없음"}
        </h1>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSave} type="button">
            저장
          </button>
          <button className="btn" onClick={onClose} type="button">
            닫기
          </button>
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: 20 }}>
        <div className="form-field">
          <label htmlFor="report-title">제목</label>
          <input
            id="report-title"
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            value={draft.title}
          />
        </div>
        <div className="form-field">
          <label htmlFor="report-content">활동 내용</label>
          <textarea
            id="report-content"
            onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
            value={draft.content}
          />
        </div>
      </div>

      <div className="summary-2x2">
        <div>
          <div className="summary-label">활동 날짜</div>
          <div className="summary-value">{draft.date}</div>
        </div>
        <div>
          <div className="summary-label">참석 인원</div>
          <div className="summary-value">{attendeeRows.length}명</div>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>번호</th>
            <th>이름</th>
            <th>Knox ID</th>
            <th>비고</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {attendeeRows.map((member, index) => (
            <tr key={member.id}>
              <td>{index + 1}</td>
              <td>{member.name}</td>
              <td>{member.knoxId}</td>
              <td>{member.note ?? ""}</td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => removeAttendee(member.id)} type="button">
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="data-table-footer">
              총인원
            </td>
            <td className="data-table-footer">{attendeeRows.length}명</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
        <select onChange={(event) => setNewAttendeeId(event.target.value)} value={newAttendeeId}>
          <option value="">참가자 선택</option>
          {availableMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} ({member.knoxId})
            </option>
          ))}
        </select>
        <button className="btn btn-sm" disabled={!newAttendeeId} onClick={addAttendee} type="button">
          참가자 추가
        </button>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="view-header">
          <h2>활동 계획서</h2>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn btn-sm" onClick={handlePickPlanFile} type="button">
            파일 첨부
          </button>
          <button className="btn btn-sm" disabled={isFindingPlanFile} onClick={handleAutoDetectPlanFile} type="button">
            {isFindingPlanFile ? "찾는 중..." : "자동 첨부"}
          </button>
          <span className="view-subtitle">{planFileName ?? "첨부된 파일 없음"}</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <MediaSection
          emptyMessage="불러온 사진이 없습니다."
          files={draft.photoFileNames}
          isScanning={isScanning === "Photos"}
          onPreview={setPreviewImageUrl}
          onRemove={(url) => removeMediaFile("photoFileNames", url)}
          onScan={() => handleScan("Photos")}
          title="사진"
        />
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <MediaSection
          emptyMessage="불러온 영수증이 없습니다."
          files={draft.receiptFileNames}
          isScanning={isScanning === "Receipts"}
          onPreview={setPreviewImageUrl}
          onRemove={(url) => removeMediaFile("receiptFileNames", url)}
          onScan={() => handleScan("Receipts")}
          title="영수증"
        />
        <LineItemTable
          onChange={(rows) => setDraft((current) => ({ ...current, receipts: rows as ReceiptItem[] }))}
          rows={draft.receipts}
        />
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <MediaSection
          emptyMessage="불러온 경비 자료가 없습니다."
          files={draft.expenseFileNames}
          isScanning={isScanning === "Expenses"}
          onPreview={setPreviewImageUrl}
          onRemove={(url) => removeMediaFile("expenseFileNames", url)}
          onScan={() => handleScan("Expenses")}
          title="경비"
        />
        <LineItemTable
          onChange={(rows) => setDraft((current) => ({ ...current, expenses: rows as ExpenseItem[] }))}
          rows={draft.expenses}
        />
      </div>

      {previewImageUrl && (
        <div className="image-preview-overlay" onClick={() => setPreviewImageUrl(null)}>
          <img alt="" className="image-preview-content" src={previewImageUrl} />
        </div>
      )}
    </div>
  );
}
