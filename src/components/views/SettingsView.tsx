import { useState } from "react";
import { pickFile, pickFolder } from "../../data/mediaStore";
import { saveSettings } from "../../data/settingsStore";
import { toDisplayableFileUrl } from "../../utils/fileUrl";
import type { AppSettings } from "../../types/domain";

type CategoryFolderKey = "photosFolder" | "bankFolder" | "receiptsFolder" | "expensesFolder" | "planFolder";

// {root}\Photos style default - only used to seed the folder-browse dialog's starting location.
function joinFolder(root: string, category: string) {
  if (!root) {
    return category;
  }

  const separator = root.includes("\\") ? "\\" : "/";

  return root.endsWith("/") || root.endsWith("\\") ? `${root}${category}` : `${root}${separator}${category}`;
}

interface SettingsViewProps {
  settings: AppSettings;
  onSaved: (next: AppSettings) => void;
  onSystemMessage: (message: string) => void;
}

function LogoPreview({ logoPath }: { logoPath: string }) {
  const [failed, setFailed] = useState(false);

  if (!logoPath) {
    return null;
  }

  if (failed) {
    return <p className="view-subtitle">미리보기를 표시할 수 없습니다. 경로를 확인해 주세요.</p>;
  }

  return (
    <div className="club-logo" key={logoPath} style={{ width: 72, height: 72 }}>
      <img
        alt="로고 미리보기"
        className="club-logo-image"
        onError={() => setFailed(true)}
        src={toDisplayableFileUrl(logoPath)}
      />
    </div>
  );
}

export function SettingsView({ settings, onSaved, onSystemMessage }: SettingsViewProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);

  const update = <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handlePickLogo = async () => {
    try {
      const picked = await pickFile();

      if (picked) {
        update("clubLogoPath", picked.path);
        onSystemMessage(`클럽 로고 파일을 선택했습니다: ${picked.name}`);
      }
    } catch (error) {
      onSystemMessage(error instanceof Error ? `파일 선택 실패: ${error.message}` : "파일 선택에 실패했습니다.");
    }
  };

  const handlePickMemberImportFile = async () => {
    try {
      const picked = await pickFile();

      if (picked) {
        update("memberImportFilePath", picked.path);
        onSystemMessage(`회원 자동불러오기 파일을 선택했습니다: ${picked.name}`);
      }
    } catch (error) {
      onSystemMessage(error instanceof Error ? `파일 선택 실패: ${error.message}` : "파일 선택에 실패했습니다.");
    }
  };

  // Opens the folder browser starting at {데이터 루트 폴더}\{category} (e.g. D:\Club\Photos) so
  // the common case is a single confirm click, while still allowing navigation elsewhere.
  const handlePickCategoryFolder = async (key: CategoryFolderKey, category: string) => {
    if (!window.clubApp) {
      onSystemMessage("폴더 선택은 Electron 앱(npm start)에서만 가능합니다. 브라우저에서는 경로를 직접 입력해 주세요.");
      return;
    }

    try {
      const defaultPath = draft[key] || joinFolder(draft.dataRootFolder, category);
      const picked = await pickFolder(defaultPath);

      if (picked) {
        update(key, picked.path);
        onSystemMessage(`${category} 폴더를 선택했습니다: ${picked.path}`);
      }
    } catch (error) {
      onSystemMessage(error instanceof Error ? `폴더 선택 실패: ${error.message}` : "폴더 선택에 실패했습니다.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await saveSettings(draft);
      onSaved(draft);
      onSystemMessage("설정을 저장했습니다.");
    } catch (error) {
      onSystemMessage(error instanceof Error ? error.message : "설정 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="view-header">
        <h1>Settings</h1>
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="settings-club-name">클럽 이름</label>
          <input
            id="settings-club-name"
            onChange={(event) => update("clubName", event.target.value)}
            value={draft.clubName}
          />
        </div>

        <div className="form-field">
          <label htmlFor="settings-club-logo">클럽 로고</label>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              id="settings-club-logo"
              onChange={(event) => update("clubLogoPath", event.target.value)}
              placeholder="로고 이미지 경로"
              style={{ flex: 1 }}
              value={draft.clubLogoPath}
            />
            <button className="btn btn-sm" onClick={handlePickLogo} type="button">
              찾아보기
            </button>
          </div>
          <LogoPreview logoPath={draft.clubLogoPath} />
        </div>

        <div className="form-field">
          <label htmlFor="settings-club-intro">클럽 소개</label>
          <textarea
            id="settings-club-intro"
            onChange={(event) => update("clubIntro", event.target.value)}
            value={draft.clubIntro}
          />
        </div>

        <div className="form-field">
          <label htmlFor="settings-data-root">
            데이터 루트 폴더 (사진/통장/영수증/경비 폴더의 기준 경로: Photos, Bank, Receipts, Expenses 하위 폴더를 자동으로 찾습니다)
          </label>
          <input
            id="settings-data-root"
            onChange={(event) => update("dataRootFolder", event.target.value)}
            placeholder={"예: D:\\Club"}
            value={draft.dataRootFolder}
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="settings-photos-folder">Photos 폴더 (비워두면 데이터 루트 폴더/Photos)</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                id="settings-photos-folder"
                onChange={(event) => update("photosFolder", event.target.value)}
                placeholder="Photos"
                style={{ flex: 1 }}
                value={draft.photosFolder}
              />
              <button className="btn btn-sm" onClick={() => handlePickCategoryFolder("photosFolder", "Photos")} type="button">
                찾아보기
              </button>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="settings-bank-folder">Bank 폴더 (비워두면 데이터 루트 폴더/Bank)</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                id="settings-bank-folder"
                onChange={(event) => update("bankFolder", event.target.value)}
                placeholder="Bank"
                style={{ flex: 1 }}
                value={draft.bankFolder}
              />
              <button className="btn btn-sm" onClick={() => handlePickCategoryFolder("bankFolder", "Bank")} type="button">
                찾아보기
              </button>
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="settings-receipts-folder">Receipts 폴더 (비워두면 데이터 루트 폴더/Receipts)</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                id="settings-receipts-folder"
                onChange={(event) => update("receiptsFolder", event.target.value)}
                placeholder="Receipts"
                style={{ flex: 1 }}
                value={draft.receiptsFolder}
              />
              <button
                className="btn btn-sm"
                onClick={() => handlePickCategoryFolder("receiptsFolder", "Receipts")}
                type="button"
              >
                찾아보기
              </button>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="settings-expenses-folder">Expenses 폴더 (비워두면 데이터 루트 폴더/Expenses)</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                id="settings-expenses-folder"
                onChange={(event) => update("expensesFolder", event.target.value)}
                placeholder="Expenses"
                style={{ flex: 1 }}
                value={draft.expensesFolder}
              />
              <button
                className="btn btn-sm"
                onClick={() => handlePickCategoryFolder("expensesFolder", "Expenses")}
                type="button"
              >
                찾아보기
              </button>
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="settings-plan-folder">Plan 폴더 (비워두면 데이터 루트 폴더/Plan)</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                id="settings-plan-folder"
                onChange={(event) => update("planFolder", event.target.value)}
                placeholder="Plan"
                style={{ flex: 1 }}
                value={draft.planFolder}
              />
              <button className="btn btn-sm" onClick={() => handlePickCategoryFolder("planFolder", "Plan")} type="button">
                찾아보기
              </button>
            </div>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="settings-report-club-name">
            보고서 클럽 이름 (월간 정리 Excel 제목 "[YY년 M월] 클럽 이름 활동 보고"에 사용, 비워두면 클럽 이름 사용)
          </label>
          <input
            id="settings-report-club-name"
            onChange={(event) => update("reportClubName", event.target.value)}
            placeholder="예: SNRC"
            value={draft.reportClubName}
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="settings-sponsorship-single">1회 참석 활동비 (원)</label>
            <input
              id="settings-sponsorship-single"
              onChange={(event) => update("sponsorshipSingleAttendance", Number(event.target.value) || 0)}
              type="number"
              value={draft.sponsorshipSingleAttendance}
            />
          </div>
          <div className="form-field">
            <label htmlFor="settings-sponsorship-multiple">2회 이상 참석 활동비 (원)</label>
            <input
              id="settings-sponsorship-multiple"
              onChange={(event) => update("sponsorshipMultipleAttendance", Number(event.target.value) || 0)}
              type="number"
              value={draft.sponsorshipMultipleAttendance}
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="settings-member-import-path">
            회원 자동불러오기 파일 경로 (비워두면 assets\members.json 또는 assets\members.txt)
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              id="settings-member-import-path"
              onChange={(event) => update("memberImportFilePath", event.target.value)}
              placeholder={"예: assets\\members.txt"}
              style={{ flex: 1 }}
              value={draft.memberImportFilePath}
            />
            <button className="btn btn-sm" onClick={handlePickMemberImportFile} type="button">
              찾아보기
            </button>
          </div>
        </div>

        <div className="form-field">
          <label>회원 불러오기 파일 형식 (assets\members.json 또는 assets\members.txt)</label>
          <div className="segmented-control">
            <button
              className={draft.memberImportFormat === "txt" ? "segmented-option active" : "segmented-option"}
              onClick={() => update("memberImportFormat", "txt")}
              type="button"
            >
              TXT
            </button>
            <button
              className={draft.memberImportFormat === "json" ? "segmented-option active" : "segmented-option"}
              onClick={() => update("memberImportFormat", "json")}
              type="button"
            >
              JSON
            </button>
          </div>
        </div>

        <div className="form-field">
          <label>회원 불러오기 방식</label>
          <div className="segmented-control">
            <button
              className={draft.memberImportMode === "append" ? "segmented-option active" : "segmented-option"}
              onClick={() => update("memberImportMode", "append")}
              type="button"
            >
              추가
            </button>
            <button
              className={draft.memberImportMode === "replace" ? "segmented-option active" : "segmented-option"}
              onClick={() => update("memberImportMode", "replace")}
              type="button"
            >
              교체
            </button>
          </div>
        </div>

        <div className="form-actions" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-primary" disabled={isSaving} onClick={handleSave} type="button">
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
