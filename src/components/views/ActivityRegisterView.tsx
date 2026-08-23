import { useState } from "react";
import { computeWeekOfMonth, formatLocalDateIso, formatYyyyMm } from "../../data/activitiesStore";
import { ensureMediaFolders, findPlanFiles, pickFile } from "../../data/mediaStore";
import { PlanFileControls } from "./PlanFileControls";
import type { Activity, PublicMember } from "../../types/domain";

interface ActivityRegisterViewProps {
  currentMember: PublicMember;
  members: PublicMember[];
  onCreate: (activity: Activity) => void;
  onSystemMessage: (message: string) => void;
}

const today = formatLocalDateIso();

export function ActivityRegisterView({ currentMember, members, onCreate, onSystemMessage }: ActivityRegisterViewProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [weekOfMonth, setWeekOfMonth] = useState(computeWeekOfMonth(today));
  const [planFiles, setPlanFiles] = useState<Array<{ path: string; name: string }>>([]);
  const [content, setContent] = useState("");
  const [isFindingPlanFile, setIsFindingPlanFile] = useState(false);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [isAttendeePickerOpen, setIsAttendeePickerOpen] = useState(false);

  const activeMembers = members
    .filter((member) => !member.withdrawn)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const selectedAttendeeIdSet = new Set(attendeeIds);
  const selectedAttendees = attendeeIds
    .map((id) => activeMembers.find((member) => member.id === id))
    .filter((member): member is PublicMember => Boolean(member));

  const handleDateChange = (value: string) => {
    setDate(value);
    setWeekOfMonth(computeWeekOfMonth(value));
  };

  const handlePickPlanFile = async () => {
    const picked = await pickFile();

    if (picked) {
      setPlanFiles((current) => (current.some((file) => file.path === picked.path) ? current : [...current, picked]));
      onSystemMessage(`활동 계획서를 첨부했습니다: ${picked.name}`);
    }
  };

  const handleAutoDetectPlanFile = async () => {
    setIsFindingPlanFile(true);

    try {
      const found = await findPlanFiles(formatYyyyMm(date), weekOfMonth);

      if (found.length > 0) {
        setPlanFiles((current) => {
          const existingPaths = new Set(current.map((file) => file.path));
          return [...current, ...found.filter((file) => !existingPaths.has(file.path))];
        });
        onSystemMessage(`계획서 파일 ${found.length}개를 자동으로 찾아 첨부했습니다.`);
      } else {
        onSystemMessage("일치하는 계획서 파일을 찾지 못했습니다. (Plan 폴더와 파일명을 확인해 주세요)");
      }
    } finally {
      setIsFindingPlanFile(false);
    }
  };

  const handleRemovePlanFile = (path: string) => {
    setPlanFiles((current) => current.filter((file) => file.path !== path));
  };

  const toggleAttendee = (memberId: string) => {
    setAttendeeIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      onSystemMessage("제목을 입력해 주세요.");
      return;
    }

    const activity: Activity = {
      id: `activity-${Date.now()}`,
      title: title.trim(),
      date,
      weekOfMonth,
      planFilePaths: planFiles.map((file) => file.path),
      content,
      attendeeIds,
      photoFileNames: [],
      receiptFileNames: [],
      expenseFileNames: [],
      receipts: [],
      expenses: [],
      createdBy: currentMember.id,
      createdAt: new Date().toISOString()
    };

    await ensureMediaFolders(formatYyyyMm(date), weekOfMonth);
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
          <PlanFileControls
            isFinding={isFindingPlanFile}
            onAutoDetect={handleAutoDetectPlanFile}
            onPick={handlePickPlanFile}
            onRemove={handleRemovePlanFile}
            onSystemMessage={onSystemMessage}
            planFiles={planFiles}
          />
        </div>

        <div className="form-field">
          <label htmlFor="activity-content">활동 내용</label>
          <textarea id="activity-content" onChange={(event) => setContent(event.target.value)} value={content} />
        </div>

        <div className="form-field">
          <label>참석자</label>
          <div className="attendee-actions">
            <button className="btn btn-sm" onClick={() => setIsAttendeePickerOpen(true)} type="button">
              참석자 선택
            </button>
            <span>선택 {attendeeIds.length}명</span>
          </div>
          {selectedAttendees.length > 0 ? (
            <div className="register-attendee-list">
              {selectedAttendees.map((member) => (
                <span className="register-attendee-chip" key={member.id}>
                  {member.name} ({member.knoxId})
                </span>
              ))}
            </div>
          ) : (
            <p className="thumbnail-empty">선택된 참석자가 없습니다.</p>
          )}
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={() => void handleSubmit()} type="button">
            활동등록
          </button>
        </div>
      </div>

      {isAttendeePickerOpen && (
        <div className="attendee-picker-overlay" onClick={() => setIsAttendeePickerOpen(false)}>
          <section
            aria-labelledby="register-attendee-picker-title"
            aria-modal="true"
            className="attendee-picker-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <h2 id="register-attendee-picker-title">참석자 선택</h2>
                <p className="attendee-picker-summary">
                  전체 회원 {activeMembers.length}명 · 선택 {attendeeIds.length}명
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsAttendeePickerOpen(false)} type="button">
                닫기
              </button>
            </div>

            <div className="attendee-picker-list">
              {activeMembers.map((member) => (
                <label className="attendee-picker-row" key={member.id}>
                  <input
                    checked={selectedAttendeeIdSet.has(member.id)}
                    onChange={() => toggleAttendee(member.id)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{member.name}</strong>
                    <small>{member.knoxId}</small>
                  </span>
                </label>
              ))}
            </div>

            <div className="attendee-picker-actions">
              <button className="btn btn-ghost" onClick={() => setAttendeeIds([])} type="button">
                선택 해제
              </button>
              <button className="btn btn-primary" onClick={() => setIsAttendeePickerOpen(false)} type="button">
                확인
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
