export type MemberGrade = "회장" | "총무" | "감사" | "정회원";

export type MemberRole = "admin" | "일반";

export type ThemeMode = "light" | "dark";

export interface Member {
  id: string;
  name: string;
  knoxId: string;
  passwordHash: string;
  department: string;
  contact: string;
  joinDate: string;
  grade: MemberGrade;
  role: MemberRole;
  note?: string;
  // Soft-delete flag: "삭제" no longer erases the record, so a completed activity's attendee
  // history (attendeeIds) keeps resolving to a real name instead of silently losing the row.
  // Withdrawn members are hidden from MembersView/roster pickers but still resolvable by id.
  withdrawn: boolean;
}

// Member shape sent to the renderer - never carries the password hash.
export type PublicMember = Omit<Member, "passwordHash">;

export interface ReceiptItem {
  id: string;
  date: string;
  item: string;
  price: number;
  note?: string;
  fileName?: string;
}

export interface ExpenseItem {
  id: string;
  date: string;
  item: string;
  price: number;
  note?: string;
  fileName?: string;
}

export interface Activity {
  id: string;
  title: string;
  date: string;
  weekOfMonth: number;
  planFilePaths: string[];
  content: string;
  attendeeIds: string[];
  photoFileNames: string[];
  receiptFileNames: string[];
  expenseFileNames: string[];
  receipts: ReceiptItem[];
  expenses: ExpenseItem[];
  createdBy: string;
  createdAt: string;
}

export type BoardCategory = "공지" | "일반" | "요청" | "QnA";

export interface BoardComment {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  parentCommentId?: string;
}

export interface BoardPost {
  id: string;
  category: BoardCategory;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  pinned: boolean;
  comments: BoardComment[];
}

export type MemberImportFormat = "json" | "txt";

export type MemberImportMode = "append" | "replace";

export interface AppSettings {
  theme: ThemeMode;
  clubName: string;
  clubLogoPath: string;
  clubIntro: string;
  dataRootFolder: string;
  // Per-category folder overrides - empty means "use <dataRootFolder>/<category>" (unchanged
  // default behavior). Same input style/semantics as dataRootFolder.
  photosFolder: string;
  receiptsFolder: string;
  expensesFolder: string;
  planFolder: string;
  memberImportFormat: MemberImportFormat;
  memberImportMode: MemberImportMode;
  // Empty means "use assets/members.json or assets/members.txt" (unchanged default behavior).
  memberImportFilePath: string;
  sponsorshipSingleAttendance: number;
  sponsorshipMultipleAttendance: number;
  // Club name used in report titles (e.g. "[26년 7월] {reportClubName} 활동 보고"). Falls back to
  // clubName when empty.
  reportClubName: string;
}

export interface MediaScanResult {
  folder: string;
  files: string[];
}

export interface LoginResult {
  ok: boolean;
  member?: PublicMember;
  error?: string;
}
