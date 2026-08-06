import { CalendarPlus, ClipboardList, FilePlus2, Home, MessageSquare, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { ViewMode } from "../../App";

interface SidebarProps {
  view: ViewMode;
  isAdmin: boolean;
  onNavigate: (view: ViewMode) => void;
}

const mainNavItems: Array<{ view: ViewMode; label: string; icon: ReactNode }> = [
  { view: "home", label: "Home", icon: <Home size={18} /> },
  { view: "activities", label: "Activities", icon: <CalendarPlus size={18} /> },
  { view: "board", label: "Board", icon: <MessageSquare size={18} /> }
];

const bottomNavItems: Array<{ view: ViewMode; label: string; icon: ReactNode; adminOnly?: boolean }> = [
  { view: "activity-register", label: "활동 등록", icon: <FilePlus2 size={16} /> },
  { view: "weekly-report", label: "주간 정리", icon: <ClipboardList size={16} />, adminOnly: true },
  { view: "monthly-report", label: "월간 정리", icon: <ClipboardList size={16} /> },
  { view: "members", label: "회원 관리", icon: <Users size={16} /> }
];

export function Sidebar({ view, isAdmin, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="주 메뉴">
      <nav className="sidebar-nav">
        {mainNavItems.map((item) => (
          <button
            className={view === item.view ? "sidebar-nav-button active" : "sidebar-nav-button"}
            key={item.view}
            onClick={() => onNavigate(item.view)}
            type="button"
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <nav className="sidebar-bottom">
        {bottomNavItems.map((item) => {
          const disabled = Boolean(item.adminOnly) && !isAdmin;

          return (
            <button
              className={view === item.view ? "sidebar-bottom-button active" : "sidebar-bottom-button"}
              disabled={disabled}
              key={item.view}
              onClick={() => onNavigate(item.view)}
              title={disabled ? "admin 전용 메뉴입니다." : undefined}
              type="button"
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
