import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
  planFilePath?: string;
  content: string;
  attendeeIds: string[];
  photoFileNames: string[];
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

// A single attendance in the month earns 50,000; two or more earn 100,000 - matches
// MonthlyReportDetail.tsx.
function calculateSponsorship(attendedCount: number) {
  if (attendedCount <= 0) {
    return 0;
  }

  return attendedCount === 1 ? 50000 : 100000;
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
        const buffer = await readFile(filePath);
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
  field: "photoFileNames" | "receiptFileNames" | "expenseFileNames",
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

function buildAttendanceTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  monthActivities: Activity[],
  members: Member[],
  startCol = 1
): number {
  const attendanceRows = members
    .map((member) => {
      const marks = monthActivities.map((activity) => activity.attendeeIds.includes(member.id));
      const attendedCount = marks.filter(Boolean).length;

      return { member, marks, attendedCount, sponsorship: calculateSponsorship(attendedCount) };
    })
    .filter((row) => row.attendedCount > 0)
    .sort((a, b) => b.attendedCount - a.attendedCount);

  const weekHeaders = monthActivities.map((activity, index) => `${index + 1}차 (${activity.date.slice(5)})`);
  let row = startRow;

  setHeaderRow(sheet, row, ["번호", "이름", "Knox ID", ...weekHeaders, "합", "후원금액"], startCol);
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
        formatWon(entry.sponsorship)
      ],
      startCol
    );
    row += 1;
  });

  const totalSponsorship = attendanceRows.reduce((sum, entry) => sum + entry.sponsorship, 0);

  row += 1;
  setDataRow(sheet, row, ["총원", attendanceRows.length], startCol);
  setDataRow(sheet, row + 1, ["총 후원금액", formatWon(totalSponsorship)], startCol);

  return row + 3;
}

// Summary lays its sections out side-by-side (참석자 | 사진 | 영수증(사진+표) | 경비(사진+표))
// rather than stacked, so each panel starts at a computed column offset from the previous one.
async function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  yyyyMm: string,
  monthActivities: Activity[],
  members: Member[]
) {
  const sheet = workbook.addWorksheet("Summary");
  const attendedMemberCount = members.filter((member) =>
    monthActivities.some((activity) => activity.attendeeIds.includes(member.id))
  ).length;

  sheet.getCell("A1").value = `${yyyyMm} 월간 정리`;
  sheet.getCell("A1").font = { bold: true, size: 14 };

  // 2x2: 이달의 활동 수 / 참석 인원 - matches the .summary-2x2 card on screen.
  setHeaderRow(sheet, 3, ["이달의 활동 수", "참석 인원"]);
  setDataRow(sheet, 4, [`${monthActivities.length}건`, `${attendedMemberCount}명`]);

  const panelRow = 6;
  const attendanceCol = 1;
  const attendanceWidth = 3 + monthActivities.length + 2;

  buildAttendanceTable(sheet, panelRow, monthActivities, members, attendanceCol);

  const photosCol = attendanceCol + attendanceWidth + PANEL_GAP_COLS;

  setSectionTitle(sheet, panelRow, "사진", 12, photosCol);
  await writePhotosByWeek(
    workbook,
    sheet,
    panelRow + 1,
    monthActivities,
    "photoFileNames",
    SUMMARY_PANEL_IMAGES_PER_ROW,
    photosCol
  );

  const receiptsCol = photosCol + SUMMARY_PANEL_WIDTH + PANEL_GAP_COLS;

  setSectionTitle(sheet, panelRow, "영수증", 12, receiptsCol);
  const afterReceiptPhotos = await writePhotosByWeek(
    workbook,
    sheet,
    panelRow + 1,
    monthActivities,
    "receiptFileNames",
    SUMMARY_PANEL_IMAGES_PER_ROW,
    receiptsCol
  );
  writeCombinedLineItemTable(sheet, afterReceiptPhotos, monthActivities, "receipts", receiptsCol);

  const expensesCol = receiptsCol + SUMMARY_PANEL_WIDTH + PANEL_GAP_COLS;

  setSectionTitle(sheet, panelRow, "경비", 12, expensesCol);
  const afterExpensePhotos = await writePhotosByWeek(
    workbook,
    sheet,
    panelRow + 1,
    monthActivities,
    "expenseFileNames",
    SUMMARY_PANEL_IMAGES_PER_ROW,
    expensesCol
  );
  writeCombinedLineItemTable(sheet, afterExpensePhotos, monthActivities, "expenses", expensesCol);

  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 16;
}

async function writePlanFileRow(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, startRow: number, activity: Activity) {
  let row = startRow;

  sheet.getCell(`A${row}`).value = "활동 계획서";

  if (!activity.planFilePath) {
    sheet.getCell(`B${row}`).value = "첨부된 파일 없음";
    return row + 2;
  }

  const fileName = activity.planFilePath.split(/[\\/]/).pop() ?? activity.planFilePath;
  const extension = IMAGE_EXTENSION_MAP[path.extname(activity.planFilePath).toLowerCase()];

  sheet.getCell(`B${row}`).value = fileName;
  row += 1;

  if (extension) {
    try {
      const buffer = await readFile(activity.planFilePath);
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

  return row + 1;
}

async function buildWeekSheet(
  workbook: ExcelJS.Workbook,
  weekNumber: number,
  yyyyMm: string,
  activities: Activity[],
  members: Member[]
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

    const attendeeRows = activity.attendeeIds
      .map((id) => members.find((member) => member.id === id))
      .filter((member): member is Member => Boolean(member));

    setHeaderRow(sheet, row, ["번호", "이름", "Knox ID", "비고"]);
    row += 1;

    attendeeRows.forEach((member, index) => {
      setDataRow(sheet, row, [index + 1, member.name, member.knoxId, member.note ?? ""]);
      row += 1;
    });

    setDataRow(sheet, row, ["총인원", attendeeRows.length]);
    row += 2;

    setSectionTitle(sheet, row, "사진", 12);
    row += 1;
    row = await placeImageGrid(workbook, sheet, row, activity.photoFileNames);
    if (activity.photoFileNames.length === 0) {
      sheet.getCell(`A${row}`).value = "등록된 사진이 없습니다.";
      row += 2;
    }

    setSectionTitle(sheet, row, "영수증", 12);
    row += 1;
    row = await placeImageGrid(workbook, sheet, row, activity.receiptFileNames);
    if (activity.receiptFileNames.length === 0) {
      sheet.getCell(`A${row}`).value = "등록된 영수증 사진이 없습니다.";
      row += 1;
    }
    setHeaderRow(sheet, row, ["날짜", "구매 내용", "가격", "비고"]);
    row += 1;
    activity.receipts.forEach((item) => {
      setDataRow(sheet, row, [item.date, item.item, formatWon(item.price), item.note ?? ""]);
      row += 1;
    });
    row += 1;

    setSectionTitle(sheet, row, "경비", 12);
    row += 1;
    row = await placeImageGrid(workbook, sheet, row, activity.expenseFileNames);
    if (activity.expenseFileNames.length === 0) {
      sheet.getCell(`A${row}`).value = "등록된 경비 사진이 없습니다.";
      row += 1;
    }
    setHeaderRow(sheet, row, ["날짜", "구매 내용", "가격", "비고"]);
    row += 1;
    activity.expenses.forEach((item) => {
      setDataRow(sheet, row, [item.date, item.item, formatWon(item.price), item.note ?? ""]);
      row += 1;
    });

    row += 3;
  }

  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 40;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 24;
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

  members.forEach((member, index) => {
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
  const activities = await readJsonFile<Activity[]>(dataDir, "activities.json", []);
  const members = await readJsonFile<Member[]>(dataDir, "members.json", []);

  const monthActivities = activities
    .filter((activity) => activity.date.startsWith(yyyyMm))
    .sort((a, b) => a.date.localeCompare(b.date));

  const workbook = new ExcelJS.Workbook();

  await buildSummarySheet(workbook, yyyyMm, monthActivities, members);

  const activitiesByWeek = new Map<number, Activity[]>();

  monthActivities.forEach((activity) => {
    const list = activitiesByWeek.get(activity.weekOfMonth) ?? [];

    list.push(activity);
    activitiesByWeek.set(activity.weekOfMonth, list);
  });

  for (const weekNumber of Array.from(activitiesByWeek.keys()).sort((a, b) => a - b)) {
    await buildWeekSheet(workbook, weekNumber, yyyyMm, activitiesByWeek.get(weekNumber) ?? [], members);
  }

  await buildMediaSheet(workbook, "영수증", monthActivities, "receiptFileNames", "receipts");
  await buildMediaSheet(workbook, "경비", monthActivities, "expenseFileNames", "expenses");

  buildMembersSheet(workbook, members);

  return workbook;
}
