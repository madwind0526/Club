import { useState } from "react";
import { computeWeekOfMonth, formatYyyyMm } from "../../data/activitiesStore";
import { findPlanFile, pickFile } from "../../data/mediaStore";
import type { Activity, PublicMember } from "../../types/domain";

interface ActivityRegisterViewProps {
  currentMember: PublicMember;
  onCreate: (activity: Activity) => void;
  onSystemMessage: (message: string) => void;
}

const today = new Date().toISOString().slice(0, 10);

export function ActivityRegisterView({ currentMember, onCreate, onSystemMessage }: ActivityRegisterViewProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [weekOfMonth, setWeekOfMonth] = useState(computeWeekOfMonth(today));
  const [planFile, setPlanFile] = useState<{ path: string; name: string } | null>(null);
  const [content, setContent] = useState("");
  const [isFindingPlanFile, setIsFindingPlanFile] = useState(false);

  const handleDateChange = (value: string) => {
    setDate(value);
    setWeekOfMonth(computeWeekOfMonth(value));
  };

  const handlePickPlanFile = async () => {
    const picked = await pickFile();

    if (picked) {
      setPlanFile(picked);
      onSystemMessage(`활동 계획서를 선택했습니다: ${picked.name}`);
    }
  };

  const handleAutoDetectPlanFile = async () => {
    setIsFindingPlanFile(true);

    try {
      const found = await findPlanFile(formatYyyyMm(date), weekOfMonth);

      if (found) {
        setPlanFile(found);
        onSystemMessage(`계획서 파일을 자동으로 찾았습니다: ${found.name}`);
      } else {
        onSystemMessage("일치하는 계획서 파일을 찾지 못했습니다. (Plan 폴더와 파일명을 확인해 주세요)");
      }
    } finally {
      setIsFindingPlanFile(false);
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      onSystemMessage("제목을 입력해 주세요.");
      return;
    }

    const activity: Activity = {
      id: `activity-${Date.now()}`,
      title: title.trim(),
      date,
      weekOfMonth,
      planFilePath: planFile?.path,
      content,
      attendeeIds: [],
      photoFileNames: [],
      receiptFileNames: [],
      expenseFileNames: [],
      receipts: [],
      expenses: [],
      createdBy: currentMember.id,
      createdAt: new Date().toISOString()
    };

    onCreate(activity);
  };

  return (
    <div>
      <div className="view-header">
        <h1>활동 등록</h1>
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="activity-title">제목</label>
          <input id="activity-title" onChange={(event) => setTitle(event.target.value)} value={title} />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="activity-date">날짜</label>
            <input
              id="activity-date"
              onChange={(event) => handleDateChange(event.target.value)}
              type="date"
              value={date}
            />
          </div>
          <div className="form-field">
            <label htmlFor="activity-week">주차</label>
            <input
              id="activity-week"
              max={5}
              min={1}
              onChange={(event) => setWeekOfMonth(Number(event.target.value) || 1)}
              type="number"
              value={weekOfMonth}
            />
          </div>
        </div>

        <div className="form-field">
          <label>활동 계획서</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn btn-sm" onClick={handlePickPlanFile} type="button">
              파일 첨부
            </button>
            <button className="btn btn-sm" disabled={isFindingPlanFile} onClick={handleAutoDetectPlanFile} type="button">
              {isFindingPlanFile ? "찾는 중..." : "자동 첨부"}
            </button>
            <span className="view-subtitle">{planFile?.name ?? "선택된 파일 없음"}</span>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="activity-content">활동 내용</label>
          <textarea id="activity-content" onChange={(event) => setContent(event.target.value)} value={content} />
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSubmit} type="button">
            활동등록
          </button>
        </div>
      </div>
    </div>
  );
}
