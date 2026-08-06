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
