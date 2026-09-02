import { useEffect, useMemo, useState } from "react";
import { TopToolbar } from "./components/layout/TopToolbar";
import { Sidebar } from "./components/layout/Sidebar";
import { LoginView } from "./components/views/LoginView";
import { ProfileView } from "./components/views/ProfileView";
import { SettingsView } from "./components/views/SettingsView";
import { HomeView } from "./components/views/HomeView";
import { ActivitiesView } from "./components/views/ActivitiesView";
import { ActivityQuickViewModal } from "./components/views/ActivityQuickViewModal";
import { ActivityRegisterView } from "./components/views/ActivityRegisterView";
import { ActivityReportView } from "./components/views/ActivityReportView";
import { BoardView } from "./components/views/BoardView";
import { MembersView } from "./components/views/MembersView";
import { WeeklyReportView } from "./components/views/WeeklyReportView";
import { MonthlyReportView } from "./components/views/MonthlyReportView";
import { MonthlyReportDetail } from "./components/views/MonthlyReportDetail";
import { DbRestoreView } from "./components/views/DbRestoreView";
import { clearSession, fetchServerSession, loadSession, logout as serverLogout, saveSession } from "./data/authStore";
import { defaultSettings, loadSettings } from "./data/settingsStore";
import { listMembers } from "./data/membersStore";
import { listActivities, saveActivities as persistActivities } from "./data/activitiesStore";
import { listBoardPosts, saveBoardPosts as persistBoardPosts } from "./data/boardStore";
import { openFileExternally } from "./data/mediaStore";
import { backupDatabase } from "./data/dbBackupStore";
import type { Activity, AppSettings, BoardPost, PublicMember, ThemeMode } from "./types/domain";

export type ViewMode =
  | "home"
  | "activities"
  | "activity-register"
  | "board"
  | "members"
  | "weekly-report"
  | "monthly-report"
  | "settings"
  | "profile"
  | "db-backup"
  | "db-restore";

export type ActivitiesViewMode = "photo" | "card" | "list";

// Menus the server also treats as admin-only (see vite.config.mts / electron/main.ts) - kept
// here so navigating to one shows a warning instead of silently rendering nothing. "db-backup"
// isn't a real view (see navigate() below) but still needs the same admin gate.
const ADMIN_ONLY_VIEWS = new Set<ViewMode>(["activity-register", "weekly-report", "settings", "db-backup", "db-restore"]);

const MONTHLY_EXCEL_REPORTS_KEY = "club-management.monthlyExcelReports";

function loadMonthlyExcelReports() {
  try {
    const raw = localStorage.getItem(MONTHLY_EXCEL_REPORTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveMonthlyExcelReports(paths: Record<string, string>) {
  try {
    localStorage.setItem(MONTHLY_EXCEL_REPORTS_KEY, JSON.stringify(paths));
  } catch {
    // Keeping the in-memory path is still useful for the current session.
  }
}

// Theme is a per-browser preference controlled from the toolbar, never part of shared settings.
const THEME_OVERRIDE_KEY = "club-management.themeOverride";

function loadThemeOverride(): ThemeMode | null {
  try {
    const raw = localStorage.getItem(THEME_OVERRIDE_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    return null;
  }
}

function saveThemeOverride(theme: ThemeMode) {
  try {
    localStorage.setItem(THEME_OVERRIDE_KEY, theme);
  } catch {
    // Falls back to light mode next load - not worth surfacing an error for.
  }
}

export function App() {
  const [session, setSession] = useState<PublicMember | null>(() => loadSession());
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);
  const [view, setView] = useState<ViewMode>("home");
  const [activitiesViewMode, setActivitiesViewMode] = useState<ActivitiesViewMode>("card");
  const [query, setQuery] = useState("");
  const [quickViewActivityId, setQuickViewActivityId] = useState<string | null>(null);
  const [reportModalActivityId, setReportModalActivityId] = useState<string | null>(null);
  const [monthlyReportMonth, setMonthlyReportMonth] = useState<string | null>(null);
  const [monthlyExcelReports, setMonthlyExcelReports] = useState<Record<string, string>>(() => loadMonthlyExcelReports());
  const [themeOverride, setThemeOverride] = useState<ThemeMode | null>(() => loadThemeOverride());
  const [systemMessage, setSystemMessage] = useState("준비되었습니다.");
  // The cached (localStorage) `session` above is only ever a UI hint, never proof of a valid
  // login - without this flag, the very first render would trust that stale cache and flash the
  // full app (Home, Sidebar, ...) before the async server-side check below has a chance to run
  // and (if the session is actually invalid) revert it. Gating on this instead of `session`
  // guarantees LoginView is what's on screen until the server has actually confirmed the session.
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  const effectiveTheme = themeOverride ?? "light";

  const toggleTheme = () => {
    const next: ThemeMode = effectiveTheme === "dark" ? "light" : "dark";
    setThemeOverride(next);
    saveThemeOverride(next);
  };

  const applyLoadedProtectedData = (
    loadedMembers: PublicMember[],
    loadedActivities: Activity[],
    loadedBoardPosts: BoardPost[],
    sessionMember: PublicMember
  ) => {
    setMembers(loadedMembers);
    setActivities(loadedActivities);
    setBoardPosts(loadedBoardPosts);

    const refreshed = loadedMembers.find((member) => member.id === sessionMember.id) ?? sessionMember;
    saveSession(refreshed);
    setSession(refreshed);
  };

  const loadProtectedData = async (sessionMember: PublicMember) => {
    const [loadedMembers, loadedActivities, loadedBoardPosts] = await Promise.all([
      listMembers(),
      listActivities(),
      listBoardPosts()
    ]);

    applyLoadedProtectedData(loadedMembers, loadedActivities, loadedBoardPosts, sessionMember);
  };

  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      // The cached (localStorage) session is only a UI hint - confirm it against the server's
      // actual session (cookie for the browser dev path, IPC session for Electron) before
      // trusting it for anything. An expired/invalid session here means every other fetch below
      // will come back empty (server now requires login to read club data), so log out cleanly
      // instead of showing a blank app.
      const loadedSettings = await loadSettings();

      if (!mounted) {
        return;
      }

      setSettings(loadedSettings);

      const serverSession = await fetchServerSession();

      if (!mounted) {
        return;
      }

      if (!serverSession) {
        clearSession();
        setSession(null);
        setMembers([]);
        setActivities([]);
        setBoardPosts([]);
        setSystemMessage("로그인이 필요합니다.");
        setIsAuthChecked(true);
        return;
      }

      const [loadedMembers, loadedActivities, loadedBoardPosts] = await Promise.all([
        listMembers(),
        listActivities(),
        listBoardPosts()
      ]);

      if (!mounted) {
        return;
      }

      applyLoadedProtectedData(loadedMembers, loadedActivities, loadedBoardPosts, serverSession);
      setIsAuthChecked(true);
      setSystemMessage("데이터를 불러왔습니다.");
    };

    void loadInitialData().catch(() => {
      if (mounted) {
        setSystemMessage("데이터를 불러오지 못했습니다.");
        setIsAuthChecked(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const quickViewActivity = useMemo(
    () => activities.find((activity) => activity.id === quickViewActivityId) ?? null,
    [activities, quickViewActivityId]
  );

  const reportModalActivity = useMemo(
    () => activities.find((activity) => activity.id === reportModalActivityId) ?? null,
    [activities, reportModalActivityId]
  );

  const navigate = (nextView: ViewMode) => {
    if (ADMIN_ONLY_VIEWS.has(nextView) && session?.role !== "admin") {
      setSystemMessage("권한이 없습니다. admin만 접근할 수 있는 메뉴입니다.");
      return;
    }

    // "DB 백업" isn't a screen - it runs immediately and stays on whatever view is currently open.
    if (nextView === "db-backup") {
      void handleDbBackup();
      return;
    }

    setView(nextView);
  };

  const handleDbBackup = async () => {
    setSystemMessage("DB 백업을 진행하고 있습니다...");
    const result = await backupDatabase();
    setSystemMessage(result.ok ? `DB 백업을 완료했습니다: ${result.path}` : result.error ?? "DB 백업에 실패했습니다.");
  };

  const openActivityPopup = (activityId: string) => {
    setQuickViewActivityId(activityId);
  };

  const applyActivities = async (nextActivities: Activity[]) => {
    const previousActivities = activities;
    setActivities(nextActivities);

    try {
      await persistActivities(nextActivities);
    } catch (error) {
      // Roll back the optimistic update - a rejected save (e.g. a non-admin's browser blindly
      // POSTing a new activity) must not leave the UI showing a change the server didn't keep.
      setActivities(previousActivities);
      setSystemMessage(error instanceof Error ? error.message : "활동 데이터를 저장하지 못했습니다.");
    }
  };

  const applyBoardPosts = async (nextPosts: BoardPost[]) => {
    const previousPosts = boardPosts;
    setBoardPosts(nextPosts);

    try {
      await persistBoardPosts(nextPosts);
    } catch (error) {
      setBoardPosts(previousPosts);
      setSystemMessage(error instanceof Error ? error.message : "게시글을 저장하지 못했습니다.");
    }
  };

  const handleLoginSuccess = (member: PublicMember) => {
    saveSession(member);
    setSession(member);
    setSystemMessage(`${member.name}님, 환영합니다.`);
    setView("home");
    void loadProtectedData(member)
      .then(() => setSystemMessage("데이터를 불러왔습니다."))
      .catch(() => setSystemMessage("데이터를 불러오지 못했습니다."));
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setSystemMessage("로그아웃했습니다.");
    void serverLogout();
  };

  // Used after the current user edits their own profile - keeps the member list and the
  // cached session in sync so the change shows up immediately everywhere in the UI.
  const handleOwnProfileUpdated = (nextMembers: PublicMember[]) => {
    setMembers(nextMembers);
    setSession((current) => {
      if (!current) {
        return current;
      }

      const refreshed = nextMembers.find((member) => member.id === current.id);

      if (refreshed) {
        saveSession(refreshed);
      }

      return refreshed ?? current;
    });
  };

  const handleSelectActivitiesViewMode = (mode: ActivitiesViewMode) => {
    setActivitiesViewMode(mode);
    setView("activities");
  };

  const toggleAttendance = (activity: Activity) => {
    if (!session) {
      return;
    }

    const isAttending = activity.attendeeIds.includes(session.id);
    const nextAttendeeIds = isAttending
      ? activity.attendeeIds.filter((id) => id !== session.id)
      : [...activity.attendeeIds, session.id];

    void applyActivities(
      activities.map((current) => (current.id === activity.id ? { ...current, attendeeIds: nextAttendeeIds } : current))
    );
    setSystemMessage(isAttending ? "참가를 취소했습니다." : "참가 신청을 완료했습니다.");
  };

  const openReportFor = (activityId: string) => {
    setReportModalActivityId(activityId);
    setQuickViewActivityId(null);
  };

  const handleDeleteActivity = (activityId: string) => {
    const activity = activities.find((current) => current.id === activityId);

    void applyActivities(activities.filter((current) => current.id !== activityId));
    setSystemMessage(activity ? `"${activity.title || "제목 없음"}" 활동을 삭제했습니다.` : "활동을 삭제했습니다.");
  };

  const handleMonthlyExcelExported = (yyyyMm: string, filePath: string) => {
    setMonthlyExcelReports((current) => {
      const next = { ...current, [yyyyMm]: filePath };
      saveMonthlyExcelReports(next);
      return next;
    });
  };

  const handleOpenMonthlyExcelReport = async (yyyyMm: string) => {
    const filePath = monthlyExcelReports[yyyyMm];

    if (!filePath) {
      setSystemMessage("저장된 Excel 리포트 경로가 없습니다.");
      return;
    }

    const result = await openFileExternally(filePath);
    setSystemMessage(result.ok ? "Excel 리포트를 열었습니다." : result.error ?? "Excel 리포트를 열지 못했습니다.");
  };

  if (!isAuthChecked) {
    return (
      <div className={`login-screen ${effectiveTheme}`}>
        <div className="login-card" style={{ textAlign: "center" }}>
          <h1>{settings.clubName}</h1>
          <p className="board-post-meta">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginView clubName={settings.clubName} onLoginSuccess={handleLoginSuccess} theme={effectiveTheme} />;
  }

  return (
    <main className={`app-shell ${effectiveTheme}`}>
      <TopToolbar
        activitiesViewMode={activitiesViewMode}
        clubName={settings.clubName}
        onLogout={handleLogout}
        onOpenProfile={() => navigate("profile")}
        onOpenSettings={() => navigate("settings")}
        onQueryChange={setQuery}
        onSelectActivitiesViewMode={handleSelectActivitiesViewMode}
        onToggleTheme={toggleTheme}
        query={query}
        theme={effectiveTheme}
        view={view}
      />

      <Sidebar isAdmin={session.role === "admin"} onNavigate={navigate} view={view} />

      <section className="main-window">
        {view === "home" && (
          <HomeView
            activities={activities}
            members={members}
            onNavigate={navigate}
            onOpenActivity={openActivityPopup}
            settings={settings}
          />
        )}

        {view === "activities" && (
          <ActivitiesView
            activities={activities}
            onDeleteActivity={session.role === "admin" ? handleDeleteActivity : undefined}
            onOpenActivity={openActivityPopup}
            query={query}
            viewMode={activitiesViewMode}
          />
        )}

        {view === "activity-register" && session.role === "admin" && (
          <ActivityRegisterView
            currentMember={session}
            members={members}
            onCreate={(activity) => {
              void applyActivities([activity, ...activities]);
              navigate("activities");
              setReportModalActivityId(activity.id);
              setSystemMessage("새 활동을 등록했습니다. 상세 내용을 이어서 입력해 주세요.");
            }}
            onSystemMessage={setSystemMessage}
          />
        )}

        {view === "board" && (
          <BoardView
            currentMember={session}
            members={members}
            onSave={applyBoardPosts}
            onSystemMessage={setSystemMessage}
            posts={boardPosts}
          />
        )}

        {view === "db-restore" && session.role === "admin" && <DbRestoreView onSystemMessage={setSystemMessage} />}

        {view === "members" && (
          <MembersView
            currentMember={session}
            members={members}
            onMembersChange={setMembers}
            onSystemMessage={setSystemMessage}
            settings={settings}
          />
        )}

        {view === "weekly-report" && session.role === "admin" && (
          <WeeklyReportView activities={activities} onDeleteActivity={handleDeleteActivity} onOpenActivity={openReportFor} />
        )}
        {view === "monthly-report" && (
          <MonthlyReportView
            activities={activities}
            excelReportPaths={monthlyExcelReports}
            onOpenExcelReport={(yyyyMm) => void handleOpenMonthlyExcelReport(yyyyMm)}
            onOpenMonth={setMonthlyReportMonth}
          />
        )}

        {view === "settings" && session.role === "admin" && (
          <SettingsView
            onSaved={setSettings}
            onSystemMessage={setSystemMessage}
            settings={settings}
          />
        )}

        {view === "profile" && (
          <ProfileView
            member={session}
            onLogout={handleLogout}
            onMembersChange={handleOwnProfileUpdated}
            onSystemMessage={setSystemMessage}
          />
        )}
      </section>

      {quickViewActivity && (
        <ActivityQuickViewModal
          activity={quickViewActivity}
          currentMember={session}
          onClose={() => setQuickViewActivityId(null)}
          onOpenReport={() => openReportFor(quickViewActivity.id)}
          onToggleAttendance={() => toggleAttendance(quickViewActivity)}
        />
      )}

      {reportModalActivity && (
        <div className="modal-overlay" onClick={() => setReportModalActivityId(null)}>
          <div className="modal modal-wide" onClick={(event) => event.stopPropagation()}>
            <ActivityReportView
              activity={reportModalActivity}
              currentMember={session}
              members={members}
              onClose={() => setReportModalActivityId(null)}
              onSave={(nextActivity) => {
                void applyActivities(
                  activities.map((activity) => (activity.id === nextActivity.id ? nextActivity : activity))
                );
              }}
              onSystemMessage={setSystemMessage}
            />
          </div>
        </div>
      )}

      {monthlyReportMonth && (
        <div className="modal-overlay" onClick={() => setMonthlyReportMonth(null)}>
          <div className="modal modal-wide" onClick={(event) => event.stopPropagation()}>
            <MonthlyReportDetail
              activities={activities}
              currentMember={session}
              members={members}
              onClose={() => setMonthlyReportMonth(null)}
              onExported={handleMonthlyExcelExported}
              onSystemMessage={setSystemMessage}
              settings={settings}
              yyyyMm={monthlyReportMonth}
            />
          </div>
        </div>
      )}

      <footer className="system-message" aria-live="polite">
        <span>System</span>
        <strong>{systemMessage}</strong>
      </footer>
    </main>
  );
}
