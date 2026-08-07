// Converts a raw OS filesystem path (as returned by the native file picker, or typed into a
// settings field) into a URL an <img>/<a> tag can actually load.
//
// Inside Electron, the renderer is loaded from an http(s) origin (the Vite dev server, or the
// packaged app's origin) rather than a file:// origin, and Chromium refuses to load file:// as a
// subresource from a non-file:// page. So local files are served through a custom "club-media"
// protocol registered in electron/main.ts instead - the encoding here (opaque, single path
// segment) must match the decoding in that handler.
export function toDisplayableFileUrl(pathOrUrl: string): string {
  if (!pathOrUrl) {
    return "";
  }

  if (/^(https?:|file:|data:|club-media:)/i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  if (window.clubApp) {
    return `club-media://local/${encodeURIComponent(pathOrUrl)}`;
  }

  // Dev-only browser fallback (no Electron): best effort. Browsers cannot read arbitrary local
  // files by path at all, so this only ever works for paths already reachable as file:// URLs.
  const normalized = pathOrUrl.replace(/\\/g, "/");
  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;

  return `file://${encodeURI(withLeadingSlash)}`;
}

const PLAN_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".gif", ".png"]);
const PLAN_DOC_EXTENSIONS = new Set([".doc", ".docx"]);
const PLAN_SHEET_EXTENSIONS = new Set([".xls", ".xlsx"]);
const PLAN_SLIDE_EXTENSIONS = new Set([".ppt", ".pptx"]);

export type PlanFileKind = "image" | "pdf" | "doc" | "sheet" | "slide" | "other";

// Determines how a plan-file attachment is shown as a thumbnail and previewed: an image renders
// inline, a PDF renders inline in an iframe, everything else (doc/xls/ppt and their -x variants)
// gets an icon tile and can only be previewed by opening it in the OS default application.
export function getPlanFileKind(filePath: string): PlanFileKind {
  const extension = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();

  if (PLAN_IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  if (extension === ".pdf") {
    return "pdf";
  }

  if (PLAN_DOC_EXTENSIONS.has(extension)) {
    return "doc";
  }

  if (PLAN_SHEET_EXTENSIONS.has(extension)) {
    return "sheet";
  }

  if (PLAN_SLIDE_EXTENSIONS.has(extension)) {
    return "slide";
  }

  return "other";
}
