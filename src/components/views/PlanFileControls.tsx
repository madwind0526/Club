import { File, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { useState } from "react";
import { openFileExternally } from "../../data/mediaStore";
import { getPlanFileKind, toDisplayableFileUrl, type PlanFileKind } from "../../utils/fileUrl";

interface PlanFile {
  path: string;
  name: string;
}

interface PlanFileControlsProps {
  planFiles: PlanFile[];
  isFinding: boolean;
  onPick: () => void;
  onAutoDetect: () => void;
  onRemove: (path: string) => void;
  onSystemMessage: (message: string) => void;
  readOnly?: boolean;
}

const ICON_BY_KIND: Partial<Record<PlanFileKind, typeof FileText>> = {
  pdf: FileText,
  doc: FileText,
  sheet: FileSpreadsheet,
  slide: Presentation
};

function PlanFileTile({
  file,
  onRemove,
  onSystemMessage,
  readOnly
}: {
  file: PlanFile;
  onRemove: (path: string) => void;
  onSystemMessage: (message: string) => void;
  readOnly: boolean;
}) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const kind = getPlanFileKind(file.path);
  const Icon = ICON_BY_KIND[kind] ?? File;

  const handleThumbnailClick = async () => {
    if (kind === "image" || kind === "pdf") {
      setIsPreviewOpen(true);
      return;
    }

    const result = await openFileExternally(file.path);

    onSystemMessage(result.ok ? `${file.name} 파일을 기본 프로그램으로 열었습니다.` : result.error || "파일을 열지 못했습니다.");
  };

  return (
    <>
      <div className="thumbnail-item">
        {kind === "image" ? (
          <img alt="" className="thumbnail" onClick={handleThumbnailClick} src={toDisplayableFileUrl(file.path)} />
        ) : (
          <div className="thumbnail plan-file-icon-tile" onClick={handleThumbnailClick}>
            <Icon size={30} />
            <span>{file.name}</span>
          </div>
        )}
        {!readOnly && (
          <button className="thumbnail-delete" onClick={() => onRemove(file.path)} title="삭제" type="button">
            ×
          </button>
        )}
      </div>

      {isPreviewOpen && (
        <div className="image-preview-overlay" onClick={() => setIsPreviewOpen(false)}>
          {kind === "image" ? (
            <img alt="" className="image-preview-content" src={toDisplayableFileUrl(file.path)} />
          ) : (
            <iframe
              className="pdf-preview-content"
              onClick={(event) => event.stopPropagation()}
              src={toDisplayableFileUrl(file.path)}
              title="활동 계획서 미리보기"
            />
          )}
        </div>
      )}
    </>
  );
}

export function PlanFileControls({
  planFiles,
  isFinding,
  onPick,
  onAutoDetect,
  onRemove,
  onSystemMessage,
  readOnly = false
}: PlanFileControlsProps) {
  return (
    <>
      {!readOnly && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={onPick} type="button">
            파일 첨부
          </button>
          <button className="btn btn-sm" disabled={isFinding} onClick={onAutoDetect} type="button">
            {isFinding ? "찾는 중..." : "자동 첨부"}
          </button>
        </div>
      )}

      {planFiles.length === 0 ? (
        <p className="thumbnail-empty">첨부된 파일 없음</p>
      ) : (
        <div className="thumbnail-grid" style={{ marginTop: 10 }}>
          {planFiles.map((file) => (
            <PlanFileTile file={file} key={file.path} onRemove={onRemove} onSystemMessage={onSystemMessage} readOnly={readOnly} />
          ))}
        </div>
      )}
    </>
  );
}
