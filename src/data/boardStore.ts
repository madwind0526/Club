import type { BoardPost } from "../types/domain";

export async function listBoardPosts(): Promise<BoardPost[]> {
  if (window.clubApp?.listBoardPosts) {
    return window.clubApp.listBoardPosts();
  }

  const response = await fetch("/api/board");
  return response.ok ? response.json() : [];
}

export async function saveBoardPosts(posts: BoardPost[]): Promise<BoardPost[]> {
  if (window.clubApp?.saveBoardPosts) {
    return window.clubApp.saveBoardPosts(posts);
  }

  const response = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(posts)
  });

  return response.json();
}
