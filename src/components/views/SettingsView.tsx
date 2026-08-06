import { useState } from "react";
import { pickFile } from "../../data/mediaStore";
import { saveSettings } from "../../data/settingsStore";
import { toDisplayableFileUrl } from "../../utils/fileUrl";
import type { AppSettings } from "../../types/domain";

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
    <img
      alt="로고 미리보기"
      className="club-logo"
      key={logoPath}
      onError={() => setFailed(true)}
      src={toDisplayableFileUrl(logoPath)}
      style={{ width: 72, height: 72 }}
    />
  );
}

export function SettingsView({ settings, onSaved, onSystemMessage }: SettingsViewProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);

  const update = <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handlePickLogo = async () => {
    const picked = await pickFile();

    if (picked) {
      update("clubLogoPath", picked.path);
      onSystemMessage(`클럽 로고 파일을 선택했습니다: ${picked.name}`);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await saveSettings(draft);
      onSaved(draft);
      onSystemMessage("설정을 저장했습니다.");
    } catch {
      onSystemMessage("설정 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // Theme applies (and persists) the moment it's changed - other fields still wait for the
  // explicit Save button below, so this only ever carries the theme change, not stray drafts.
  const handleThemeChange = async (theme: AppSettings["theme"]) => {
    update("theme", theme);
    const next = { ...settings, theme };
    onSaved(next);

    try {
      await saveSettings(next);
    } catch {
      onSystemMessage("테마 저장에 실패했습니다.");
    }
  };

  return (
    <div>
      <div className="view-header">
        <h1>Settings</h1>
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label>테마</label>
          <div className="segmented-control">
            <button
              className={draft.theme === "light" ? "segmented-option active" : "segmented-option"}
              onClick={() => handleThemeChange("light")}
              type="button"
            >
              라이트
            </button>
            <button
              className={draft.theme === "dark" ? "segmented-option active" : "segmented-option"}
              onClick={() => handleThemeChange("dark")}
              type="button"
            >
              다크
            </button>
          </div>
        </div>

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
            데이터 루트 폴더 (사진/영수증/경비 폴더의 기준 경로: Photos, Receipts, Expenses 하위 폴더를 자동으로 찾습니다)
          </label>
          <input
            id="settings-data-root"
            onChange={(event) => update("dataRootFolder", event.target.value)}
            placeholder={"예: D:\\Club"}
            value={draft.dataRootFolder}
          />
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" disabled={isSaving} onClick={handleSave} type="button">
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
