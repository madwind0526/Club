import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("clubApp", {
  platform: process.platform,

  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings: unknown) => ipcRenderer.invoke("settings:save", settings),

  listMembers: () => ipcRenderer.invoke("members:list"),
  addMember: (input: unknown) => ipcRenderer.invoke("members:add", input),
  updateMember: (input: unknown) => ipcRenderer.invoke("members:update", input),
  removeMember: (id: string) => ipcRenderer.invoke("members:remove", id),
  importMembers: (rows: unknown, mode: "append" | "replace") => ipcRenderer.invoke("members:import", rows, mode),
  readAssetsMembersFile: (format: "json" | "txt") => ipcRenderer.invoke("assets:readMembersFile", format),

  login: (knoxId: string, password: string) => ipcRenderer.invoke("auth:login", knoxId, password),

  listActivities: () => ipcRenderer.invoke("activities:list"),
  saveActivities: (activities: unknown) => ipcRenderer.invoke("activities:save", activities),

  listBoardPosts: () => ipcRenderer.invoke("board:list"),
  saveBoardPosts: (posts: unknown) => ipcRenderer.invoke("board:save", posts),

  pickFile: () => ipcRenderer.invoke("dialog:pickFile"),
  scanMediaFolder: (category: "Photos" | "Receipts" | "Expenses", yyyyMm: string, week: number) =>
    ipcRenderer.invoke("media:scanFolder", category, yyyyMm, week),
  findPlanFile: (yyyyMm: string, week: number) => ipcRenderer.invoke("media:findPlanFile", yyyyMm, week),
  openPath: (filePath: string) => ipcRenderer.invoke("shell:openPath", filePath),
  exportMonthlyExcel: (yyyyMm: string) => ipcRenderer.invoke("export:monthlyExcel", yyyyMm)
});
