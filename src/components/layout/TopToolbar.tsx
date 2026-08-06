import { Image, LayoutGrid, List, Search, Settings, UserRound } from "lucide-react";
import type { ActivitiesViewMode, ViewMode } from "../../App";

const BUILD_VERSION = "Build v0.1.0";

interface TopToolbarProps {
  clubName: string;
  view: ViewMode;
  activitiesViewMode: ActivitiesViewMode;
  query: string;
  onQueryChange: (query: string) => void;
  onSelectActivitiesViewMode: (mode: ActivitiesViewMode) => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
}

export function TopToolbar({
  clubName,
  view,
  activitiesViewMode,
  query,
  onQueryChange,
  onSelectActivitiesViewMode,
  onOpenSettings,
  onOpenProfile
}: TopToolbarProps) {
  return (
    <header className="top-toolbar">
      <div className="app-title">
        <strong>{clubName}</strong>
        <span>{BUILD_VERSION}</span>
      </div>

      <label className="toolbar-search">
        <Search size={16} />
        <input
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="활동 검색 (제목, 내용)"
          value={query}
        />
      </label>

      <nav className="toolbar-actions" aria-label="보기 및 설정">
        <button
          className={view === "activities" && activitiesViewMode === "photo" ? "icon-button active" : "icon-button"}
          onClick={() => onSelectActivitiesViewMode("photo")}
          title="Photo view"
          type="button"
        >
          <Image size={18} />
        </button>
        <button
          className={view === "activities" && activitiesViewMode === "card" ? "icon-button active" : "icon-button"}
          onClick={() => onSelectActivitiesViewMode("card")}
          title="Card view"
          type="button"
        >
          <LayoutGrid size={18} />
        </button>
        <button
          className={view === "activities" && activitiesViewMode === "list" ? "icon-button active" : "icon-button"}
          onClick={() => onSelectActivitiesViewMode("list")}
          title="List view"
          type="button"
        >
          <List size={18} />
        </button>
        <button
          className={view === "settings" ? "icon-button active" : "icon-button"}
          onClick={onOpenSettings}
          title="Settings"
          type="button"
        >
          <Settings size={18} />
        </button>
        <button
          className={view === "profile" ? "icon-button active" : "icon-button"}
          onClick={onOpenProfile}
          title="User profile"
          type="button"
        >
          <UserRound size={18} />
        </button>
      </nav>
    </header>
  );
}
