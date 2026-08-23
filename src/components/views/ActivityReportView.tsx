import { Trash2 } from "lucide-react";
import { useState } from "react";
import { formatYyMm, formatYyyyMm } from "../../data/activitiesStore";
import { findPlanFiles, pickFile, scanMediaFolder } from "../../data/mediaStore";
import { toDisplayableFileUrl } from "../../utils/fileUrl";
import { PlanFileControls } from "./PlanFileControls";
import type { Activity, ExpenseItem, PublicMember, ReceiptItem } from "../../types/domain";

interface ActivityReportViewProps {
  activity: Activity;
  members: PublicMember[];
  currentMember: PublicMember;
  onSave: (activity: Activity) => void;
  onSystemMessage: (message: string) => void;
  onClose: () => void;
}

type MediaCategory = "Photos" | "Receipts" | "Expenses";
type MediaField = "photoFileNames" | "receiptFileNames" | "expenseFileNames";

// 사진/영수증/경비 추가·삭제는 admin 전용 - 열람(썸네일 보기, 표 내용 보기)은 회원 누구나 그대로 가능.
function LineItemTable({
  rows,
  onChange,
  readOnly
}: {
  rows: ReceiptItem[] | ExpenseItem[];
  onChange: (rows: ReceiptItem[]) => void;
  readOnly: boolean;
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
            {!readOnly && <th>삭제</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            readOnly ? (
              <tr key={row.id}>
                <td>{row.date}</td>
                <td>{row.item}</td>
                <td>{row.price.toLocaleString()}</td>
                <td>{row.note}</td>
              </tr>
            ) : (
              <tr key={row.id}>
                <td>
                  <input
                    onChange={(event) => updateRow(row.id, { date: event.target.value })}
                    type="date"
                    value={row.date}
                  />
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
                  <button className="icon-btn" onClick={() => removeRow(row.id)} title="삭제" type="button">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
      {!readOnly && (
        <button className="btn btn-sm" onClick={addRow} style={{ marginTop: 10 }} type="button">
          + 항목 추가
        </button>
      )}
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
  onPreview,
  readOnly
}: {
  title: string;
  emptyMessage: string;
  files: string[];
  isScanning: boolean;
  onScan: () => void;
  onRemove: (url: string) => void;
  onPreview: (url: string) => void;
  readOnly: boolean;
}) {
  return (
    <>
      <div className="view-header">
        <h2>{title}</h2>
        {!readOnly && (
          <button className="btn btn-sm" disabled={isScanning} onClick={onScan} type="button">
            {isScanning ? "불러오는 중..." : "폴더에서 불러오기"}
          </button>
        )}
      </div>
      {files.length === 0 ? (
        <p className="thumbnail-empty">{emptyMessage}</p>
      ) : (
        <div className="thumbnail-grid">
          {files.map((url) => (
            <div className="thumbnail-item" key={url}>
              <img alt="" className="thumbnail" onClick={() => onPreview(url)} src={toDisplayableFileUrl(url)} />
              {!readOnly && (
                <button className="thumbnail-delete" onClick={() => onRemove(url)} title="삭제" type="button">
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function ActivityReportView({
  activity,
  members,
  currentMember,
  onSave,
  onSystemMessage,
  onClose
}: ActivityReportViewProps) {
  const [draft, setDraft] = useState<Activity>(activity);
  const [isScanning, setIsScanning] = useState<MediaCategory | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isAttendeePickerOpen, setIsAttendeePickerOpen] = useState(false);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [isFindingPlanFile, setIsFindingPlanFile] = useState(false);
  const isAdmin = currentMember.role === "admin";

  const planFiles = draft.planFilePaths.map((filePath) => ({
    path: filePath,
    name: filePath.split(/[\\/]/).pop() ?? filePath
  }));

  // A withdrawn (soft-deleted) member still needs to show up here with their real name - only
  // the 비고 column changes, to "탈퇴". A truly missing record (data from before this existed)
  // falls back to a placeholder rather than silently dropping the row and shrinking 참석 인원.
  const attendeeRows = draft.attendeeIds
    .map((id) => {
      const member = members.find((candidate) => candidate.id === id);

      if (!member) {
        return { id, name: "(알 수 없음)", knoxId: "", note: "탈퇴" };
      }

      return { id: member.id, name: member.name, knoxId: member.knoxId, note: member.withdrawn ? "탈퇴" : member.note ?? "" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const activeMembers = members
    .filter((member) => !member.withdrawn)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const activeMemberIdSet = new Set(activeMembers.map((member) => member.id));
  const selectedAttendeeIdSet = new Set(selectedAttendeeIds);
  const selectedActiveAttendeeCount = selectedAttendeeIds.filter((id) => activeMemberIdSet.has(id)).length;

  const openAttendeePicker = () => {
    setSelectedAttendeeIds(draft.attendeeIds);
    setIsAttendeePickerOpen(true);
  };

  const toggleSelectedAttendee = (memberId: string) => {
    setSelectedAttendeeIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  };

  const confirmSelectedAttendees = () => {
    setDraft((current) => ({ ...current, attendeeIds: selectedAttendeeIds }));
    onSystemMessage(`참석자 명단을 ${selectedAttendeeIds.length}명으로 변경했습니다.`);
    setIsAttendeePickerOpen(false);
  };

  const removeAttendee = (memberId: string) => {
    setDraft((current) => ({ ...current, attendeeIds: current.attendeeIds.filter((id) => id !== memberId) }));
  };

  const isSelfAttending = draft.attendeeIds.includes(currentMember.id);

  const toggleSelfAttendance = () => {
    setDraft((current) => ({
      ...current,
      attendeeIds: isSelfAttending
        ? current.attendeeIds.filter((id) => id !== currentMember.id)
        : [...current.attendeeIds, currentMember.id]
    }));
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
      setDraft((current) => ({
        ...current,
        planFilePaths: current.planFilePaths.includes(picked.path)
          ? current.planFilePaths
          : [...current.planFilePaths, picked.path]
      }));
      onSystemMessage(`활동 계획서를 첨부했습니다: ${picked.name}`);
    }
  };

  const handleAutoDetectPlanFile = async () => {
    setIsFindingPlanFile(true);

    try {
      const found = await findPlanFiles(formatYyyyMm(draft.date), draft.weekOfMonth);

      if (found.length > 0) {
        setDraft((current) => {
          const existingPaths = new Set(current.planFilePaths);
          const newPaths = found.map((file) => file.path).filter((filePath) => !existingPaths.has(filePath));

          return { ...current, planFilePaths: [...current.planFilePaths, ...newPaths] };
        });
        onSystemMessage(`계획서 파일 ${found.length}개를 자동으로 찾아 첨부했습니다.`);
      } else {
        onSystemMessage("일치하는 계획서 파일을 찾지 못했습니다. (Plan 폴더와 파일명을 확인해 주세요)");
      }
    } finally {
      setIsFindingPlanFile(false);
    }
  };

  const handleRemovePlanFile = (filePath: string) => {
    setDraft((current) => ({ ...current, planFilePaths: current.planFilePaths.filter((path) => path !== filePath) }));
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
          <button className="btn btn-primary" onClick={onClose} type="button">
            닫기
          </button>
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: 20 }}>
        <div className="form-field">
          <label htmlFor="report-title">제목</label>
          {isAdmin ? (
            <input
              id="report-title"
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              value={draft.title}
            />
          ) : (
            <p id="report-title">{draft.title || "제목 없음"}</p>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="report-content">활동 내용</label>
          {isAdmin ? (
            <textarea
              id="report-content"
              onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              value={draft.content}
            />
          ) : (
            <p id="report-content" style={{ whiteSpace: "pre-wrap" }}>
              {draft.content || "내용이 없습니다."}
            </p>
          )}
        </div>
      </div>

      <div className="summary-2x2 activity-report-summary">
        <div>
          <div className="summary-label">활동 날짜</div>
          <div className="summary-value">{draft.date}</div>
        </div>
        <div>
          <div className="summary-label">참석 인원</div>
          <div className="summary-value">{attendeeRows.length}명</div>
        </div>
      </div>

      <table className="data-table attendee-table">
        <thead>
          <tr>
            <th className="attendee-col-number">번호</th>
            <th className="attendee-col-name">이름</th>
            <th className="attendee-col-knox">Knox ID</th>
            <th>비고</th>
            {isAdmin && <th className="attendee-col-delete">삭제</th>}
          </tr>
        </thead>
        <tbody>
          {attendeeRows.map((row, index) => (
            <tr key={row.id}>
              <td className="attendee-col-number">{index + 1}</td>
              <td>{row.name}</td>
              <td>{row.knoxId}</td>
              <td>{row.note}</td>
              {isAdmin && (
                <td className="attendee-col-delete">
                  <button className="icon-btn" onClick={() => removeAttendee(row.id)} title="참석자 삭제" type="button">
                    <Trash2 size={15} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={isAdmin ? 4 : 3} className="data-table-footer">
              총인원
            </td>
            <td className="data-table-footer">{attendeeRows.length}명</td>
          </tr>
        </tfoot>
      </table>

      {isAdmin ? (
        <div className="attendee-actions">
          <button className="btn btn-sm" disabled={activeMembers.length === 0} onClick={openAttendeePicker} type="button">
            참석자 변경
          </button>
          <span>현재 {attendeeRows.length}명</span>
        </div>
      ) : (
        <div className="attendee-actions">
          <button
            className={isSelfAttending ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm"}
            onClick={toggleSelfAttendance}
            type="button"
          >
            {isSelfAttending ? "참가 취소" : "참가 신청"}
          </button>
          <span>본인 참석 여부만 변경할 수 있습니다.</span>
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <div className="view-header">
          <h2>활동 계획서</h2>
        </div>
        <PlanFileControls
          isFinding={isFindingPlanFile}
          onAutoDetect={handleAutoDetectPlanFile}
          onPick={handlePickPlanFile}
          onRemove={handleRemovePlanFile}
          onSystemMessage={onSystemMessage}
          planFiles={planFiles}
          readOnly={!isAdmin}
        />
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <MediaSection
          emptyMessage="불러온 사진이 없습니다."
          files={draft.photoFileNames}
          isScanning={isScanning === "Photos"}
          onPreview={setPreviewImageUrl}
          onRemove={(url) => removeMediaFile("photoFileNames", url)}
          onScan={() => handleScan("Photos")}
          readOnly={!isAdmin}
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
          readOnly={!isAdmin}
          title="영수증"
        />
        <LineItemTable
          onChange={(rows) => setDraft((current) => ({ ...current, receipts: rows as ReceiptItem[] }))}
          readOnly={!isAdmin}
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
          readOnly={!isAdmin}
          title="경비"
        />
        <LineItemTable
          onChange={(rows) => setDraft((current) => ({ ...current, expenses: rows as ExpenseItem[] }))}
          readOnly={!isAdmin}
          rows={draft.expenses}
        />
      </div>

      {previewImageUrl && (
        <div className="image-preview-overlay" onClick={() => setPreviewImageUrl(null)}>
          <img alt="" className="image-preview-content" src={toDisplayableFileUrl(previewImageUrl)} />
        </div>
      )}

      {isAttendeePickerOpen && (
        <div className="attendee-picker-overlay" onClick={() => setIsAttendeePickerOpen(false)}>
          <section
            aria-labelledby="attendee-picker-title"
            aria-modal="true"
            className="attendee-picker-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <h2 id="attendee-picker-title">참석자 변경</h2>
                <p className="attendee-picker-summary">
                  전체 회원 {activeMembers.length}명 · 선택 {selectedActiveAttendeeCount}명
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsAttendeePickerOpen(false)} type="button">
                닫기
              </button>
            </div>

            <div className="attendee-picker-list">
              {activeMembers.map((member) => {
                const isChecked = selectedAttendeeIdSet.has(member.id);

                return (
                  <label className="attendee-picker-row" key={member.id}>
                    <input
                      checked={isChecked}
                      onChange={() => toggleSelectedAttendee(member.id)}
                      type="checkbox"
                    />
                    <span>
                      <strong>{member.name}</strong>
                      <small>{member.knoxId}</small>
                    </span>
                    {isChecked && <em>참석</em>}
                  </label>
                );
              })}
            </div>

            <div className="attendee-picker-actions">
              <button className="btn btn-ghost" onClick={() => setSelectedAttendeeIds([])} type="button">
                선택 해제
              </button>
              <button className="btn btn-primary" onClick={confirmSelectedAttendees} type="button">
                확인
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
