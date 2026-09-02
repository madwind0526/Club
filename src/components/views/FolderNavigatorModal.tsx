import { ArrowUp, Folder } from "lucide-react";
import { useEffect, useState } from "react";
import { listDirectory } from "../../data/mediaStore";
import type { DirectoryListing } from "../../types/domain";

interface FolderNavigatorModalProps {
  title: string;
  onConfirm: (path: string) => void;
  onCancel: () => void;
}

// Backs 월간 정리 > Excel로 내보내기's 저장 폴더 선택 - a built-in folder browser (plain fs.readdir,
// no OS shell) used instead of the native Explorer "Save As" dialog for this one feature only.
// Every other file/folder picker in the app (Settings' 폴더 찾아보기 buttons, 계획서 첨부, 로고 선택)
// keeps using the native dialog as before.
export function FolderNavigatorModal({ title, onConfirm, onCancel }: FolderNavigatorModalProps) {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = async (dirPath?: string) => {
    setIsLoading(true);

    try {
      const result = await listDirectory(dirPath);

      setListing(result);
      setPathInput(result.path);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canConfirm = Boolean(listing) && !listing?.error;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} type="button">
            닫기
          </button>
        </div>

        <div className="folder-navigator-shortcuts">
          {listing?.shortcuts.map((shortcut) => (
            <button className="btn btn-sm" key={shortcut.path} onClick={() => void load(shortcut.path)} type="button">
              {shortcut.label}
            </button>
          ))}
        </div>

        <div className="folder-navigator-pathbar">
          <button
            className="icon-btn"
            disabled={!listing?.parent}
            onClick={() => listing?.parent && void load(listing.parent)}
            title="상위 폴더로 이동"
            type="button"
          >
            <ArrowUp size={15} />
          </button>
          <input
            onChange={(event) => setPathInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void load(pathInput);
              }
            }}
            value={pathInput}
          />
          <button className="btn btn-sm" onClick={() => void load(pathInput)} type="button">
            이동
          </button>
        </div>

        <div className="folder-navigator-list">
          {isLoading ? (
            <p className="thumbnail-empty">불러오는 중...</p>
          ) : listing && listing.entries.length > 0 ? (
            listing.entries.map((entry) => (
              <button
                className="folder-navigator-row"
                key={entry.path}
                onClick={() => void load(entry.path)}
                type="button"
              >
                <Folder size={15} />
                {entry.name}
              </button>
            ))
          ) : (
            <p className="thumbnail-empty">하위 폴더가 없습니다.</p>
          )}
        </div>

        {listing?.error && <p className="login-error">{listing.error}</p>}

        <div className="form-actions" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn" onClick={onCancel} type="button">
            취소
          </button>
          <button
            className="btn btn-primary"
            disabled={!canConfirm}
            onClick={() => listing && onConfirm(listing.path)}
            type="button"
          >
            이 폴더에 저장
          </button>
        </div>
      </div>
    </div>
  );
}
