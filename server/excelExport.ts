import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveAppPath } from "./paths.js";

// Mirrors the shapes in src/types/domain.ts. Duplicated here (rather than imported) so this
// Node-context module stays fully independent of the renderer's tsconfig/build graph.
interface LineItem {
  id: string;
  date: string;
  item: string;
  price: number;
  note?: string;
}

interface Activity {
  id: string;
  title: string;
  date: string;
  weekOfMonth: number;
  planFilePaths: string[];
  content: string;
  attendeeIds: string[];
  photoFileNames: string[];
  bankFileNames: string[];
  receiptFileNames: string[];
  expenseFileNames: string[];
  receipts: LineItem[];
  expenses: LineItem[];
}

interface Member {
  id: string;
  name: string;
  knoxId: string;
  department: string;
  contact: string;
  joinDate: string;
  grade: string;
  role: string;
  note?: string;
  withdrawn: boolean;
}

interface ReportSettings {
  reportClubName?: string;
  clubName?: string;
  sponsorshipSingleAttendance?: number;
  sponsorshipMultipleAttendance?: number;
}

async function readJsonFile<T>(dataDir: string, name: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path.join(dataDir, name), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// The renderer stores media references as club-media://local/<encoded path> URLs (see
// src/utils/fileUrl.ts) - this reverses that encoding to get back a real filesystem path.
function decodeClubMediaPath(url: string): string | null {
  const prefix = "club-media://local/";

  if (!url.startsWith(prefix)) {
    return null;
  }

  try {
    return decodeURIComponent(url.slice(prefix.length));
  } catch {
    return null;
  }
}

function formatWon(amount: number) {
  return `${amount.toLocaleString()}원`;
}

interface SponsorshipConfig {
  single: number;
  multiple: number;
}

// A single attendance in the month earns `single`; two or more earn `multiple` - matches
// MonthlyReportDetail.tsx. Both amounts come from Settings (sponsorshipSingleAttendance /
// sponsorshipMultipleAttendance).
function calculateSponsorship(attendedCount: number, config: SponsorshipConfig) {
  if (attendedCount <= 0) {
    return 0;
  }

  return attendedCount === 1 ? config.single : config.multiple;
}

// "[26년 7월] SNRC 동호회 활동 보고" - the club name portion is configurable in Settings.
function buildReportTitle(yyyyMm: string, clubName: string) {
  const [yearFull, monthStr] = yyyyMm.split("-");
  const yy = yearFull.slice(2);
  const month = parseInt(monthStr, 10);

  return `[${yy}년 ${month}월] ${clubName} 활동 보고`;
}

const TABLE_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" }
};

function setHeaderRow(sheet: ExcelJS.Worksheet, row: number, headers: string[], startCol = 1) {
  headers.forEach((header, index) => {
    const cell = sheet.getRow(row).getCell(startCol + index);

    cell.value = header;
    cell.font = { bold: true };
    cell.border = TABLE_BORDER;
  });
}

function setDataRow(sheet: ExcelJS.Worksheet, row: number, values: Array<string | number>, startCol = 1) {
  values.forEach((value, index) => {
    const cell = sheet.getRow(row).getCell(startCol + index);

    cell.value = value;
    cell.border = TABLE_BORDER;
  });
}

function setSectionTitle(sheet: ExcelJS.Worksheet, row: number, title: string, size = 13, startCol = 1) {
  const cell = sheet.getRow(row).getCell(startCol);

  cell.value = title;
  cell.font = { bold: true, size };
}

// A "1x2" mini table (label | value) - used for 활동비 합 / 행사 경비 신청·지출 금액 합.
function write1x2(sheet: ExcelJS.Worksheet, row: number, col: number, label: string, value: string) {
  const labelCell = sheet.getRow(row).getCell(col);

  labelCell.value = label;
  labelCell.font = { bold: true };
  labelCell.border = TABLE_BORDER;

  const valueCell = sheet.getRow(row).getCell(col + 1);

  valueCell.value = value;
  valueCell.border = TABLE_BORDER;
}

const IMAGE_EXTENSION_MAP: Record<string, "jpeg" | "png" | "gif"> = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".gif": "gif"
};

const IMAGES_PER_ROW = 4;
const IMAGE_CELL_SIZE = 110;
const IMAGE_ROW_HEIGHT_UNITS = 6;
const IMAGE_COLS_PER_IMAGE = 2;

// A narrower grid used inside the Summary sheet's side-by-side panels, so each panel (사진 /
// 영수증 / 경비) stays a fixed, predictable width.
const SUMMARY_PANEL_IMAGES_PER_ROW = 2;
const SUMMARY_PANEL_WIDTH = SUMMARY_PANEL_IMAGES_PER_ROW * IMAGE_COLS_PER_IMAGE;
const PANEL_GAP_COLS = 1;

// Lays out images left-to-right in a simple grid starting at `startRow`/`startCol`, returns the
// next free row below the grid. Files that no longer exist on disk, or use an extension ExcelJS
// can't embed, are skipped rather than failing the whole export.
async function placeImageGrid(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  startRow: number,
  urls: string[],
  imagesPerRow = IMAGES_PER_ROW,
  startCol = 1
): Promise<number> {
  if (urls.length === 0) {
    return startRow;
  }

  let column = 0;
  let rowOffset = 0;
  let placedAny = false;

  for (const url of urls) {
    const filePath = decodeClubMediaPath(url);
    const extension = filePath ? IMAGE_EXTENSION_MAP[path.extname(filePath).toLowerCase()] : undefined;

    if (filePath && extension) {
      try {
        const buffer = await readFile(resolveAppPath(filePath));
        const imageId = workbook.addImage({ base64: buffer.toString("base64"), extension });

        sheet.addImage(imageId, {
          tl: { col: startCol - 1 + column * IMAGE_COLS_PER_IMAGE, row: startRow + rowOffset * IMAGE_ROW_HEIGHT_UNITS },
          ext: { width: IMAGE_CELL_SIZE, height: IMAGE_CELL_SIZE }
        });
        placedAny = true;
      } catch {
        // Referenced file no longer exists on disk - skip it.
      }
    }

    column += 1;

    if (column >= imagesPerRow) {
      column = 0;
      rowOffset += 1;
    }
  }

  if (!placedAny) {
    return startRow;
  }

  const rowsUsed = Math.ceil(urls.length / imagesPerRow) * IMAGE_ROW_HEIGHT_UNITS;

  return startRow + rowsUsed + 1;
}

// "N차 (date) 제목" sub-header followed by that activity's image grid, for every activity that
// has files in `field`. Used for the 사진/영수증/경비 photo groupings, which are always
// organized per-week ("1,2,3,4,5차 각각의 ... 사진").
async function writePhotosByWeek(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  startRow: number,
  monthActivities: Activity[],
  field: "photoFileNames" | "bankFileNames" | "receiptFileNames" | "expenseFileNames",
  imagesPerRow = IMAGES_PER_ROW,
  startCol = 1
): Promise<number> {
  let row = startRow;
  let wroteAny = false;

  for (const [index, activity] of monthActivities.entries()) {
    const files = activity[field];

    if (files.length === 0) {
      continue;
    }

    const cell = sheet.getRow(row).getCell(startCol);

    cell.value = `${index + 1}차 (${activity.date}) ${activity.title || "제목 없음"}`;
    cell.font = { bold: true };
    row += 1;
    row = await placeImageGrid(workbook, sheet, row, files, imagesPerRow, startCol);
    wroteAny = true;
  }

  if (!wroteAny) {
    sheet.getRow(row).getCell(startCol).value = "등록된 사진이 없습니다.";
    row += 2;
  }

  return row;
}

// The combined line-item table across every activity in the month ("1,2,3,4,5차 각각 지불
// 내역이 합해진 표").
function writeCombinedLineItemTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  monthActivities: Activity[],
  itemsField: "receipts" | "expenses",
  startCol = 1
): number {
  let row = startRow;
  const allItems = monthActivities.flatMap((activity) => activity[itemsField]);

  setHeaderRow(sheet, row, ["날짜", "구매 내용", "가격", "비고"], startCol);
  row += 1;

  if (allItems.length === 0) {
    sheet.getRow(row).getCell(startCol).value = "등록된 내역이 없습니다.";
    row += 1;
  } else {
    allItems.forEach((item) => {
      setDataRow(sheet, row, [item.date, item.item, formatWon(item.price), item.note ?? ""], startCol);
      row += 1;
    });
  }

  const total = allItems.reduce((sum, item) => sum + item.price, 0);

  setDataRow(sheet, row, ["합계", "", formatWon(total)], startCol);

  return row + 2;
}

// A full "영수증"/"경비" block: section title, per-week photo grid, and the combined table
// underneath. Used by the dedicated 영수증/경비 sheets (always full-width, startCol defaults to 1).
async function writeMediaSection(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  monthActivities: Activity[],
  mediaField: "receiptFileNames" | "expenseFileNames",
  itemsField: "receipts" | "expenses"
): Promise<number> {
  let row = startRow;

  setSectionTitle(sheet, row, title);
  row += 1;

  row = await writePhotosByWeek(workbook, sheet, row, monthActivities, mediaField);
  row = writeCombinedLineItemTable(sheet, row, monthActivities, itemsField);

  return row;
}

// 사진 panel: big title, per-week photo grid, then a fixed confirmation line underneath.
async function writePhotoPanel(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  activities: Activity[]
): Promise<number> {
  let row = startRow;

  setSectionTitle(sheet, row, "활동 사진", 13, startCol);
  row += 1;

  row = await writePhotosByWeek(workbook, sheet, row, activities, "photoFileNames", SUMMARY_PANEL_IMAGES_PER_ROW, startCol);

  sheet.getRow(row).getCell(startCol).value = "본인은 동호회 운영진 총무로서 상기 사실 이상없음을 확인하였습니다";
  row += 2;

  return row;
}

// `showAllMembers` controls the roster: Summary lists every member (with O marks per week
// attended), while a week sheet's per-activity panel lists only that activity's attendees.
function buildAttendanceTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  activities: Activity[],
  members: Member[],
  startCol: number,
  showAllMembers: boolean,
  sponsorship: SponsorshipConfig
): { nextRow: number; totalSponsorship: number } {
  const attendanceRows = members
    .map((member) => {
      const marks = activities.map((activity) => activity.attendeeIds.includes(member.id));
      const attendedCount = marks.filter(Boolean).length;

      return { member, marks, attendedCount, sponsorship: calculateSponsorship(attendedCount, sponsorship) };
    })
    // showAllMembers (Summary): every active member, plus a withdrawn one only if they actually
    // attended something in this activity set. Week sheets (showAllMembers=false) already only
    // ever keep attendedCount > 0 rows, which naturally includes withdrawn attendees too.
    .filter((row) => (showAllMembers ? !row.member.withdrawn || row.attendedCount > 0 : row.attendedCount > 0))
    .sort((a, b) => {
      if (a.member.role !== b.member.role) {
        return a.member.role === "admin" ? -1 : 1;
      }

      return a.member.name.localeCompare(b.member.name, "ko");
    });

  const weekHeaders = activities.map((activity, index) => `${index + 1}차 (${activity.date.slice(5)})`);
  const weekStartCol = startCol + 3;
  let row = startRow;

  setHeaderRow(sheet, row, ["번호", "이름", "Knox ID", ...weekHeaders, "합", "활동비", "비고"], startCol);
  row += 1;

  attendanceRows.forEach((entry, index) => {
    setDataRow(
      sheet,
      row,
      [
        index + 1,
        entry.member.name,
        entry.member.knoxId,
        ...entry.marks.map((attended) => (attended ? "○" : "")),
        entry.attendedCount,
        formatWon(entry.sponsorship),
        entry.member.withdrawn ? "탈퇴" : ""
      ],
      startCol
    );

    // 1/2/3/4/5주차 출석 표시(○)는 가운데 정렬, 활동비는 오른쪽 정렬.
    weekHeaders.forEach((_, weekIndex) => {
      sheet.getRow(row).getCell(weekStartCol + weekIndex).alignment = { horizontal: "center" };
    });
    sheet.getRow(row).getCell(weekStartCol + weekHeaders.length + 1).alignment = { horizontal: "right" };

    row += 1;
  });

  const attendedRows = attendanceRows.filter((entry) => entry.attendedCount > 0);
  const totalSponsorship = attendedRows.reduce((sum, entry) => sum + entry.sponsorship, 0);

  row += 1;
  setDataRow(sheet, row, ["총원", `${attendedRows.length}명`], startCol);
  row += 1;
  setDataRow(sheet, row, ["총 활동비", formatWon(totalSponsorship)], startCol);
  row += 1;

  return { nextRow: row + 1, totalSponsorship };
}

// 참여인원 panel: big title, "출석 명단" sub-label, the attendance table, and the "활동비 합"
// 1x2 total beside the table.
async function writeAttendancePanel(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  activities: Activity[],
  members: Member[],
  showAllMembers: boolean,
  sponsorship: SponsorshipConfig
): Promise<number> {
  let row = startRow;

  setSectionTitle(sheet, row, "활동 인원 보고", 13, startCol);
  row += 1;

  setSectionTitle(sheet, row, "출석 명단", 12, startCol);
  row += 1;

  const tableStartRow = row;
  const { nextRow, totalSponsorship } = buildAttendanceTable(
    sheet,
    tableStartRow,
    activities,
    members,
    startCol,
    showAllMembers,
    sponsorship
  );
  const tableWidth = 6 + activities.length;

  write1x2(sheet, tableStartRow, startCol + tableWidth + PANEL_GAP_COLS, "활동비 합", formatWon(totalSponsorship));

  return nextRow;
}

// 영수증/경비 panel: big title, sub-label, per-week photo grid, a 1x2 total beside the photos,
// and the combined line-item table underneath (kept in addition to the total, not replacing it).
async function writeReceiptLikePanel(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  activities: Activity[],
  opts: {
    bigTitle: string;
    subLabel: string;
    sumLabel: string;
    mediaField: "receiptFileNames" | "expenseFileNames";
    itemsField: "receipts" | "expenses";
  }
): Promise<number> {
  let row = startRow;

  setSectionTitle(sheet, row, opts.bigTitle, 13, startCol);
  row += 1;

  setSectionTitle(sheet, row, opts.subLabel, 12, startCol);
  row += 1;

  const photoStartRow = row;

  row = await writePhotosByWeek(workbook, sheet, row, activities, opts.mediaField, SUMMARY_PANEL_IMAGES_PER_ROW, startCol);

  const total = activities.flatMap((activity) => activity[opts.itemsField]).reduce((sum, item) => sum + item.price, 0);

  write1x2(sheet, photoStartRow, startCol + SUMMARY_PANEL_WIDTH + PANEL_GAP_COLS, opts.sumLabel, formatWon(total));

  return writeCombinedLineItemTable(sheet, row, activities, opts.itemsField, startCol);
}

const RECEIPT_PANEL_OPTS = {
  bigTitle: "영수증 첨부",
  subLabel: "활동결과",
  sumLabel: "행사 경비 신청 금액 합",
  mediaField: "receiptFileNames" as const,
  itemsField: "receipts" as const
};

const EXPENSE_PANEL_OPTS = {
  bigTitle: "경비 첨부",
  subLabel: "활동결과",
  sumLabel: "행사 경비 지출 금액 합",
  mediaField: "expenseFileNames" as const,
  itemsField: "expenses" as const
};

// Summary lays its sections out side-by-side (사진 | 참여인원(+활동비 합) | 영수증(+금액 합) |
// 경비(+금액 합)) rather than stacked, so each panel starts at a computed column offset from the
// previous one's total width (including its 1x2 total table, where it has one).
async function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  yyyyMm: string,
  monthActivities: Activity[],
  members: Member[],
  reportClubName: string,
  sponsorship: SponsorshipConfig
) {
  const sheet = workbook.addWorksheet("Summary");
  const attendedMemberCount = members.filter((member) =>
    monthActivities.some((activity) => activity.attendeeIds.includes(member.id))
  ).length;

  sheet.getCell("A1").value = buildReportTitle(yyyyMm, reportClubName);
  sheet.getCell("A1").font = { bold: true, size: 16 };

  setSectionTitle(sheet, 3, "활동 인원", 13);
  setHeaderRow(sheet, 4, ["이달의 활동 수", "참석 인원"]);
  setDataRow(sheet, 5, [`${monthActivities.length}건`, `${attendedMemberCount}명`]);

  // 사진 shares column 1 with the 활동 인원 2x2 table above it, so it has to start below that
  // table. 참여인원/영수증/경비 sit in empty columns to the right of it, so they can start flush
  // with 활동 인원's own title row instead of waiting for 사진's row.
  const panelRow = 7;
  const sideStartRow = 3;
  const photosCol = 1;

  await writePhotoPanel(workbook, sheet, panelRow, photosCol, monthActivities);

  const attendanceCol = photosCol + SUMMARY_PANEL_WIDTH + PANEL_GAP_COLS;

  await writeAttendancePanel(sheet, sideStartRow, attendanceCol, monthActivities, members, true, sponsorship);

  const attendanceWidth = 6 + monthActivities.length;
  const receiptsCol = attendanceCol + attendanceWidth + PANEL_GAP_COLS + 2 + PANEL_GAP_COLS;

  await writeReceiptLikePanel(workbook, sheet, sideStartRow, receiptsCol, monthActivities, RECEIPT_PANEL_OPTS);

  const expensesCol = receiptsCol + SUMMARY_PANEL_WIDTH + PANEL_GAP_COLS + 2 + PANEL_GAP_COLS;

  await writeReceiptLikePanel(workbook, sheet, sideStartRow, expensesCol, monthActivities, EXPENSE_PANEL_OPTS);

  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 16;
}

async function writePlanFileRow(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, startRow: number, activity: Activity) {
  let row = startRow;

  sheet.getCell(`A${row}`).value = "활동 계획서";

  if (activity.planFilePaths.length === 0) {
    sheet.getCell(`B${row}`).value = "첨부된 파일 없음";
    return row + 2;
  }

  row += 1;

  for (const planFilePath of activity.planFilePaths) {
    const fileName = planFilePath.split(/[\\/]/).pop() ?? planFilePath;
    const extension = IMAGE_EXTENSION_MAP[path.extname(planFilePath).toLowerCase()];

    sheet.getCell(`B${row}`).value = fileName;
    row += 1;

    if (extension) {
      try {
        const buffer = await readFile(resolveAppPath(planFilePath));
        const imageId = workbook.addImage({ base64: buffer.toString("base64"), extension });

        sheet.addImage(imageId, {
          tl: { col: 0, row },
          ext: { width: IMAGE_CELL_SIZE, height: IMAGE_CELL_SIZE }
        });
        row += IMAGE_ROW_HEIGHT_UNITS;
      } catch {
        // Referenced file no longer exists on disk.
      }
    }
  }

  return row + 1;
}

// Mirrors Summary's panel layout (사진 | 참여인원 | 영수증 | 경비) per activity, but the
// 참여인원 panel here lists only that activity's actual attendees (showAllMembers = false).
async function buildWeekSheet(
  workbook: ExcelJS.Workbook,
  weekNumber: number,
  yyyyMm: string,
  activities: Activity[],
  members: Member[],
  sponsorship: SponsorshipConfig
) {
  const sheet = workbook.addWorksheet(`${weekNumber}주차`);
  let row = 1;

  for (const activity of activities) {
    setSectionTitle(sheet, row, `(${yyyyMm.slice(2)} ${weekNumber}주차 활동) ${activity.title || "제목 없음"}`);
    row += 1;

    row = await writePlanFileRow(workbook, sheet, row, activity);

    sheet.getCell(`A${row}`).value = "활동 날짜";
    sheet.getCell(`B${row}`).value = activity.date;
    row += 1;

    sheet.getCell(`A${row}`).value = "활동 내용";
    sheet.getCell(`B${row}`).value = activity.content;
    row += 1;

    sheet.getCell(`A${row}`).value = "참석 인원";
    sheet.getCell(`B${row}`).value = `${activity.attendeeIds.length}명`;
    row += 2;

    const panelRow = row;
    const photosCol = 1;

    const afterPhotos = await writePhotoPanel(workbook, sheet, panelRow, photosCol, [activity]);

    const attendanceCol = photosCol + SUMMARY_PANEL_WIDTH + PANEL_GAP_COLS;
    const afterAttendance = await writeAttendancePanel(
      sheet,
      panelRow,
      attendanceCol,
      [activity],
      members,
      false,
      sponsorship
    );

    const attendanceWidth = 6 + 1;
    const receiptsCol = attendanceCol + attendanceWidth + PANEL_GAP_COLS + 2 + PANEL_GAP_COLS;
    const afterReceipts = await writeReceiptLikePanel(workbook, sheet, panelRow, receiptsCol, [activity], RECEIPT_PANEL_OPTS);

    const expensesCol = receiptsCol + SUMMARY_PANEL_WIDTH + PANEL_GAP_COLS + 2 + PANEL_GAP_COLS;
    const afterExpenses = await writeReceiptLikePanel(workbook, sheet, panelRow, expensesCol, [activity], EXPENSE_PANEL_OPTS);

    row = Math.max(afterPhotos, afterAttendance, afterReceipts, afterExpenses) + 1;
  }

  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 40;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 24;
}

// A simple sheet: just the "통장 현황" title, then every week's bank-statement photos underneath -
// no combined line-item table, since bank statements have no per-item price/note fields.
async function buildBankSheet(workbook: ExcelJS.Workbook, monthActivities: Activity[]) {
  const sheet = workbook.addWorksheet("통장 현황");

  setSectionTitle(sheet, 1, "통장 현황");
  await writePhotosByWeek(workbook, sheet, 2, monthActivities, "bankFileNames");

  sheet.getColumn(1).width = 26;
}

async function buildMediaSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  monthActivities: Activity[],
  mediaField: "receiptFileNames" | "expenseFileNames",
  itemsField: "receipts" | "expenses"
) {
  const sheet = workbook.addWorksheet(sheetName);

  await writeMediaSection(workbook, sheet, 1, `${sheetName} 내역`, monthActivities, mediaField, itemsField);

  sheet.getColumn(1).width = 26;
  sheet.getColumn(2).width = 30;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 24;
}

function buildMembersSheet(workbook: ExcelJS.Workbook, members: Member[]) {
  const sheet = workbook.addWorksheet("회원 목록");

  setHeaderRow(sheet, 1, ["이름", "Knox ID", "부서", "연락처", "가입 날짜", "회원 등급", "역할", "비고"]);

  // admin이 항상 위쪽, 나머지는 이름 오름차순 - MembersView/참석자 표와 동일한 정렬 규칙.
  const sortedMembers = [...members].sort((a, b) => {
    if (a.role !== b.role) {
      return a.role === "admin" ? -1 : 1;
    }

    return a.name.localeCompare(b.name, "ko");
  });

  sortedMembers.forEach((member, index) => {
    setDataRow(sheet, index + 2, [
      member.name,
      member.knoxId,
      member.department,
      member.contact,
      member.joinDate,
      member.grade,
      member.role,
      member.note ?? ""
    ]);
  });

  for (let column = 1; column <= 8; column += 1) {
    sheet.getColumn(column).width = 18;
  }
}

export async function buildMonthlyReportWorkbook(dataDir: string, yyyyMm: string): Promise<ExcelJS.Workbook> {
  // bankFileNames was added after activities.json already had real activities on disk - default
  // it to [] for anything saved before that, so writePhotosByWeek's `files.length`/`files.map`
  // doesn't throw on an older activity.
  const rawActivities = await readJsonFile<Activity[]>(dataDir, "activities.json", []);
  const activities = rawActivities.map((activity) => ({ ...activity, bankFileNames: activity.bankFileNames ?? [] }));
  const members = await readJsonFile<Member[]>(dataDir, "members.json", []);
  const settings = await readJsonFile<ReportSettings>(dataDir, "app-settings.json", {});

  const sponsorship: SponsorshipConfig = {
    single: settings.sponsorshipSingleAttendance ?? 5000,
    multiple: settings.sponsorshipMultipleAttendance ?? 10000
  };
  const reportClubName = settings.reportClubName || settings.clubName || "";

  const monthActivities = activities
    .filter((activity) => activity.date.startsWith(yyyyMm))
    .sort((a, b) => a.date.localeCompare(b.date));

  const workbook = new ExcelJS.Workbook();

  await buildSummarySheet(workbook, yyyyMm, monthActivities, members, reportClubName, sponsorship);

  const activitiesByWeek = new Map<number, Activity[]>();

  monthActivities.forEach((activity) => {
    const list = activitiesByWeek.get(activity.weekOfMonth) ?? [];

    list.push(activity);
    activitiesByWeek.set(activity.weekOfMonth, list);
  });

  for (const weekNumber of Array.from(activitiesByWeek.keys()).sort((a, b) => a - b)) {
    await buildWeekSheet(workbook, weekNumber, yyyyMm, activitiesByWeek.get(weekNumber) ?? [], members, sponsorship);
  }

  await buildBankSheet(workbook, monthActivities);
  await buildMediaSheet(workbook, "영수증", monthActivities, "receiptFileNames", "receipts");
  await buildMediaSheet(workbook, "경비", monthActivities, "expenseFileNames", "expenses");

  // 회원 목록 mirrors MembersView's roster (withdrawn members hidden); attendance tables above
  // still use the full `members` list so a withdrawn attendee's history keeps resolving.
  buildMembersSheet(
    workbook,
    members.filter((member) => !member.withdrawn)
  );

  return workbook;
}
