import { File, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { useState } from "react";
import { openFileExternally } from "../../data/mediaStore";
import { getPlanFileKind, toDisplayableFileUrl, type PlanFileKind } from "../../utils/fileUrl";

interface PlanFileControlsProps {
  planFile: { path: string; name: string } | null;
  isFinding: boolean;
  onPick: () => void;
  onAutoDetect: () => void;
  onSystemMessage: (message: string) => void;
}

const ICON_BY_KIND: Partial<Record<PlanFileKind, typeof FileText>> = {
  pdf: FileText,
  doc: FileText,
  sheet: FileSpreadsheet,
  slide: Presentation
};

export function PlanFileControls({ planFile, isFinding, onPick, onAutoDetect, onSystemMessage }: PlanFileControlsProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const kind = planFile ? getPlanFileKind(planFile.path) : "other";

  const handleThumbnailClick = async () => {
    if (!planFile) {
      return;
    }

    if (kind === "image" || kind === "pdf") {
      setIsPreviewOpen(true);
      return;
    }

    const result = await openFileExternally(planFile.path);

    onSystemMessage(result.ok ? `${planFile.name} 파일을 기본 프로그램으로 열었습니다.` : result.error || "파일을 열지 못했습니다.");
  };

  const Icon = ICON_BY_KIND[kind] ?? File;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-sm" onClick={onPick} type="button">
          파일 첨부
        </button>
        <button className="btn btn-sm" disabled={isFinding} onClick={onAutoDetect} type="button">
          {isFinding ? "찾는 중..." : "자동 첨부"}
        </button>
      </div>

      {planFile ? (
        <div style={{ width: 120, marginTop: 10 }}>
          {kind === "image" ? (
            <img
              alt=""
              className="thumbnail"
              onClick={handleThumbnailClick}
              src={toDisplayableFileUrl(planFile.path)}
            />
          ) : (
            <div className="thumbnail plan-file-icon-tile" onClick={handleThumbnailClick}>
              <Icon size={30} />
              <span>{planFile.name}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="thumbnail-empty">첨부된 파일 없음</p>
      )}

      {isPreviewOpen && planFile && (
        <div className="image-preview-overlay" onClick={() => setIsPreviewOpen(false)}>
          {kind === "image" ? (
            <img alt="" className="image-preview-content" src={toDisplayableFileUrl(planFile.path)} />
          ) : (
            <iframe
              className="pdf-preview-content"
              onClick={(event) => event.stopPropagation()}
              src={toDisplayableFileUrl(planFile.path)}
              title="활동 계획서 미리보기"
            />
          )}
        </div>
      )}
    </>
  );
}
