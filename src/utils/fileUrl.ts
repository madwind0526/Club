const CLUB_MEDIA_PREFIX = "club-media://local/";
const API_MEDIA_PREFIX = "/api/media?path=";

// Converts a raw OS filesystem path (as returned by the native file picker, or typed into a
// settings field) into a URL an <img>/<a> tag can actually load - OR, if given an already-encoded
// value (a club-media:// URL from a prior Electron scan, or an /api/media?path=... URL from a
// prior browser-dev-mode scan, both persisted verbatim into activities.json), decodes it back to
// a raw path first so it can be re-encoded for whichever environment is viewing it *now*. Without
// this, media scanned once in Electron would stay permanently broken when later viewed via
// `npm run dev` in a plain browser, and vice versa.
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

  let rawPath = pathOrUrl;

  if (pathOrUrl.startsWith(CLUB_MEDIA_PREFIX)) {
    rawPath = decodeURIComponent(pathOrUrl.slice(CLUB_MEDIA_PREFIX.length));
  } else if (pathOrUrl.startsWith(API_MEDIA_PREFIX)) {
    rawPath = decodeURIComponent(pathOrUrl.slice(API_MEDIA_PREFIX.length));
  } else if (/^(https?:|file:|data:)/i.test(pathOrUrl)) {
    // A genuine external URL (e.g. a data: URI) - nothing to translate.
    return pathOrUrl;
  }

  if (window.clubApp) {
    return `${CLUB_MEDIA_PREFIX}${encodeURIComponent(rawPath)}`;
  }

  // Dev-only browser fallback (no Electron): stream the file through the same-origin /api/media
  // endpoint instead of a file:// URL, which browsers refuse to load as a subresource of an
  // http(s) page.
  return `${API_MEDIA_PREFIX}${encodeURIComponent(rawPath)}`;
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
