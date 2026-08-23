// Shared authorization rules used by both the Vite dev API (vite.config.mts) and the Electron
// main process (electron/main.ts), so the two server-side entry points enforce identical rules.

export interface SessionMember {
  id: string;
  role: string;
  withdrawn?: boolean;
}

export function isAdminMember(member: SessionMember | null | undefined): boolean {
  return member?.role === "admin";
}

// Registering or deleting an activity changes which activity ids exist. Only that ("활동 등록") is
// restricted to admins - checked separately (and first) from isEditBeyondSelfAttendanceToggle
// below, which covers in-place edits to an activity that already exists.
export function isActivityListStructuralChange(
  current: Array<{ id: string }>,
  next: Array<{ id: string }>
): boolean {
  if (current.length !== next.length) {
    return true;
  }

  const currentIds = new Set(current.map((activity) => activity.id));
  return next.some((activity) => !currentIds.has(activity.id));
}

interface ActivityForPermissionCheck {
  id: string;
  title: unknown;
  content: unknown;
  date: unknown;
  weekOfMonth: unknown;
  planFilePaths: unknown;
  attendeeIds: string[];
  photoFileNames: unknown;
  receiptFileNames: unknown;
  expenseFileNames: unknown;
  receipts: unknown;
  expenses: unknown;
}

const NON_ATTENDANCE_FIELDS = [
  "title",
  "content",
  "date",
  "weekOfMonth",
  "planFilePaths",
  "photoFileNames",
  "receiptFileNames",
  "expenseFileNames",
  "receipts",
  "expenses"
] as const;

// A non-admin may view an existing activity's full report but the only change they're allowed to
// make to it is toggling their OWN attendance - everything else (title/content/plan files,
// someone else's attendance, photos/receipts/expenses) is admin-only, matching the read-only UI
// in ActivityReportView.tsx.
export function isEditBeyondSelfAttendanceToggle(
  current: ActivityForPermissionCheck[],
  next: ActivityForPermissionCheck[],
  requesterId: string
): boolean {
  const currentById = new Map(current.map((activity) => [activity.id, activity]));

  return next.some((activity) => {
    const before = currentById.get(activity.id);

    if (!before) {
      return false; // A brand-new activity id is already caught by isActivityListStructuralChange.
    }

    if (NON_ATTENDANCE_FIELDS.some((field) => JSON.stringify(before[field]) !== JSON.stringify(activity[field]))) {
      return true;
    }

    const beforeSet = new Set(before.attendeeIds);
    const nextSet = new Set(activity.attendeeIds);
    const removed = before.attendeeIds.filter((id) => !nextSet.has(id));
    const added = activity.attendeeIds.filter((id) => !beforeSet.has(id));
    const changedIds = [...removed, ...added];

    // At most one id may change, and only the requester's own.
    return changedIds.length > 1 || (changedIds.length === 1 && changedIds[0] !== requesterId);
  });
}

// A non-admin editing their own member record (Profile screen) must not be able to smuggle a
// role/grade/knoxId change through the same endpoint the admin edit form uses.
export function sanitizeSelfMemberEdit<T extends { role: unknown; grade: unknown; knoxId: unknown }>(
  existing: T,
  incoming: T
): T {
  return { ...incoming, role: existing.role, grade: existing.grade, knoxId: existing.knoxId };
}
