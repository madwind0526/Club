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
import { clearSession, loadSession, saveSession } from "./data/authStore";
import { defaultSettings, loadSettings } from "./data/settingsStore";
import { listMembers } from "./data/membersStore";
import { listActivities, saveActivities as persistActivities } from "./data/activitiesStore";
import { listBoardPosts, saveBoardPosts as persistBoardPosts } from "./data/boardStore";
import type { Activity, AppSettings, BoardPost, PublicMember } from "./types/domain";

export type ViewMode =
  | "home"
  | "activities"
  | "activity-register"
  | "board"
  | "members"
  | "weekly-report"
  | "monthly-report"
  | "settings"
  | "profile";

export type ActivitiesViewMode = "photo" | "card" | "list";

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
  const [systemMessage, setSystemMessage] = useState("준비되었습니다.");

  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      const [loadedSettings, loadedMembers, loadedActivities, loadedBoardPosts] = await Promise.all([
        loadSettings(),
        listMembers(),
        listActivities(),
        listBoardPosts()
      ]);

      if (!mounted) {
        return;
      }

      setSettings(loadedSettings);
      setMembers(loadedMembers);
      setActivities(loadedActivities);
      setBoardPosts(loadedBoardPosts);

      // Refresh the cached session against the freshly loaded member list so role/grade
      // changes made by an admin on another launch are reflected immediately.
      setSession((current) => {
        if (!current) {
          return current;
        }

        const refreshed = loadedMembers.find((member) => member.id === current.id);
        return refreshed ?? current;
      });

      setSystemMessage("데이터를 불러왔습니다.");
    };

    void loadInitialData();

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
    setView(nextView);
  };

  const openActivityPopup = (activityId: string) => {
    setQuickViewActivityId(activityId);
  };

  const applyActivities = async (nextActivities: Activity[]) => {
    setActivities(nextActivities);

    try {
      await persistActivities(nextActivities);
    } catch {
      setSystemMessage("활동 데이터를 저장하지 못했습니다.");
    }
  };

  const applyBoardPosts = async (nextPosts: BoardPost[]) => {
    setBoardPosts(nextPosts);

    try {
      await persistBoardPosts(nextPosts);
    } catch {
      setSystemMessage("게시글을 저장하지 못했습니다.");
    }
  };

  const handleLoginSuccess = (member: PublicMember) => {
    saveSession(member);
    setSession(member);
    setSystemMessage(`${member.name}님, 환영합니다.`);
    setView("home");
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setSystemMessage("로그아웃했습니다.");
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

  if (!session) {
    return <LoginView clubName={settings.clubName} onLoginSuccess={handleLoginSuccess} theme={settings.theme} />;
  }

  return (
    <main className={`app-shell ${settings.theme}`}>
      <TopToolbar
        activitiesViewMode={activitiesViewMode}
        clubName={settings.clubName}
        onOpenProfile={() => navigate("profile")}
        onOpenSettings={() => navigate("settings")}
        onQueryChange={setQuery}
        onSelectActivitiesViewMode={handleSelectActivitiesViewMode}
        query={query}
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
            onOpenActivity={openActivityPopup}
            query={query}
            viewMode={activitiesViewMode}
          />
        )}

        {view === "activity-register" && (
          <ActivityRegisterView
            currentMember={session}
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
          <WeeklyReportView activities={activities} onOpenActivity={openReportFor} />
        )}
        {view === "monthly-report" && (
          <MonthlyReportView activities={activities} onOpenMonth={setMonthlyReportMonth} />
        )}

        {view === "settings" && (
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
              members={members}
              onClose={() => setMonthlyReportMonth(null)}
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
