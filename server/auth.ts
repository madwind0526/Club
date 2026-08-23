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
  const currentIds = new Set(current.map((activity) => activity.id));
  const nextIds = new Set(next.map((activity) => activity.id));

  if (currentIds.size !== current.length || nextIds.size !== next.length) {
    return true;
  }

  if (currentIds.size !== nextIds.size) {
    return true;
  }

  return [...currentIds].some((id) => !nextIds.has(id));
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

interface BoardCommentForPermissionCheck {
  id: string;
  authorId: string;
  content: unknown;
  createdAt: unknown;
  parentCommentId?: string;
}

interface BoardPostForPermissionCheck {
  id: string;
  category: unknown;
  title: unknown;
  content: unknown;
  authorId: string;
  createdAt: unknown;
  pinned: unknown;
  comments: BoardCommentForPermissionCheck[];
}

const BOARD_POST_IMMUTABLE_FIELDS = ["category", "title", "content", "authorId", "createdAt", "pinned"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasDuplicateIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size !== items.length;
}

export function isBoardPostListForPermissionCheck(value: unknown): value is BoardPostForPermissionCheck[] {
  return (
    Array.isArray(value) &&
    value.every(
      (post) =>
        isRecord(post) &&
        typeof post.id === "string" &&
        typeof post.authorId === "string" &&
        Array.isArray(post.comments) &&
        post.comments.every(
          (comment) =>
            isRecord(comment) &&
            typeof comment.id === "string" &&
            typeof comment.authorId === "string" &&
            (comment.parentCommentId === undefined || typeof comment.parentCommentId === "string")
        )
    )
  );
}

function hasCommentEditBeyondAppendByRequester(
  before: BoardCommentForPermissionCheck[],
  after: BoardCommentForPermissionCheck[],
  requesterId: string
): boolean {
  if (hasDuplicateIds(before) || hasDuplicateIds(after) || after.length < before.length) {
    return true;
  }

  if (before.some((comment, index) => JSON.stringify(comment) !== JSON.stringify(after[index]))) {
    return true;
  }

  const allowedParentIds = new Set(before.map((comment) => comment.id));
  const added = after.slice(before.length);

  return added.some((comment) => {
    if (comment.authorId !== requesterId) {
      return true;
    }

    if (typeof comment.id !== "string" || !comment.id || typeof comment.content !== "string" || !comment.content.trim()) {
      return true;
    }

    if (typeof comment.createdAt !== "string" || !comment.createdAt) {
      return true;
    }

    return typeof comment.parentCommentId === "string" && !allowedParentIds.has(comment.parentCommentId);
  });
}

// Board posts are persisted as a whole-array replace from the renderer. For non-admins, keep the
// server-side contract narrow: they may create their own non-notice post, delete their own post,
// and append their own comments. Everything else is admin-only.
export function isBoardEditBeyondMemberPermissions(
  current: BoardPostForPermissionCheck[],
  next: BoardPostForPermissionCheck[],
  requesterId: string
): boolean {
  if (hasDuplicateIds(current) || hasDuplicateIds(next)) {
    return true;
  }

  const currentById = new Map(current.map((post) => [post.id, post]));
  const nextById = new Map(next.map((post) => [post.id, post]));

  for (const post of current) {
    if (!nextById.has(post.id) && post.authorId !== requesterId) {
      return true;
    }
  }

  return next.some((post) => {
    const before = currentById.get(post.id);

    if (!before) {
      return post.authorId !== requesterId || post.category === "공지" || Boolean(post.pinned) || post.comments.length > 0;
    }

    if (BOARD_POST_IMMUTABLE_FIELDS.some((field) => JSON.stringify(before[field]) !== JSON.stringify(post[field]))) {
      return true;
    }

    return hasCommentEditBeyondAppendByRequester(before.comments, post.comments, requesterId);
  });
}
