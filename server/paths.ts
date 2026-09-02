import path from "node:path";

// process.cwd() is the project root both in `npm run dev`/`npm start` (tools/start-app.mjs
// spawns everything with cwd = project root) and when the compiled files here run directly.
// Bundled sample paths (assets/Logo.png, Input/...) are stored relative to this root so a fresh
// `git clone` works regardless of where it's checked out on disk - path.resolve() leaves an
// already-absolute path (e.g. one picked via the native file dialog) untouched.
export function resolveAppPath(filePath: string): string {
  return path.resolve(filePath);
}

interface FolderSettings {
  dataRootFolder?: string;
  photosFolder?: string;
  bankFolder?: string;
  receiptsFolder?: string;
  expensesFolder?: string;
  planFolder?: string;
}

// Photos/Bank/Receipts/Expenses/Plan each have an optional dedicated folder override in Settings;
// when unset, they fall back to <dataRootFolder>/<category>. Returns null when neither is set.
export function resolveCategoryFolder(
  settings: FolderSettings,
  category: "Photos" | "Bank" | "Receipts" | "Expenses"
): string | null {
  const overrideByCategory: Record<"Photos" | "Bank" | "Receipts" | "Expenses", string | undefined> = {
    Photos: settings.photosFolder,
    Bank: settings.bankFolder,
    Receipts: settings.receiptsFolder,
    Expenses: settings.expensesFolder
  };
  const override = overrideByCategory[category];

  if (override) {
    return override;
  }

  return settings.dataRootFolder ? path.join(settings.dataRootFolder, category) : null;
}

export function resolvePlanFolder(settings: FolderSettings): string | null {
  if (settings.planFolder) {
    return settings.planFolder;
  }

  return settings.dataRootFolder ? path.join(settings.dataRootFolder, "Plan") : null;
}
