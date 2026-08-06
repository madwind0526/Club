import { useMemo, useState } from "react";
import type { BoardCategory, BoardPost, PublicMember } from "../../types/domain";

interface BoardViewProps {
  posts: BoardPost[];
  members: PublicMember[];
  currentMember: PublicMember;
  onSave: (posts: BoardPost[]) => void;
  onSystemMessage: (message: string) => void;
}

const categories: Array<"전체" | BoardCategory> = ["전체", "공지", "일반", "요청", "QnA"];
const isAdmin = (member: PublicMember) => member.role === "admin";

function formatDateTime(iso: string) {
  return iso.slice(0, 16).replace("T", " ");
}

export function BoardView({ posts, members, currentMember, onSave, onSystemMessage }: BoardViewProps) {
  const [activeCategory, setActiveCategory] = useState<"전체" | BoardCategory>("전체");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [composeCategory, setComposeCategory] = useState<BoardCategory>("일반");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeContent, setComposeContent] = useState("");
  const [composePinned, setComposePinned] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<string | null>(null);

  const getAuthorName = (id: string) => members.find((member) => member.id === id)?.name ?? "알 수 없음";

  const visiblePosts = useMemo(() => {
    const filtered = activeCategory === "전체" ? posts : posts.filter((post) => post.category === activeCategory);

    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [activeCategory, posts]);

  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;

  const handleCreatePost = () => {
    if (!composeTitle.trim()) {
      onSystemMessage("제목을 입력해 주세요.");
      return;
    }

    const post: BoardPost = {
      id: `post-${Date.now()}`,
      category: composeCategory,
      title: composeTitle.trim(),
      content: composeContent,
      authorId: currentMember.id,
      createdAt: new Date().toISOString(),
      pinned: composeCategory === "공지" && composePinned,
      comments: []
    };

    onSave([post, ...posts]);
    setIsComposing(false);
    setComposeTitle("");
    setComposeContent("");
    setComposeCategory("일반");
    setComposePinned(false);
    onSystemMessage("게시글을 등록했습니다.");
  };

  const togglePin = (postId: string) => {
    onSave(posts.map((post) => (post.id === postId ? { ...post, pinned: !post.pinned } : post)));
    onSystemMessage("공지 고정 상태를 변경했습니다.");
  };

  const handleAddComment = () => {
    if (!selectedPost || !commentDraft.trim()) {
      return;
    }

    const comment = {
      id: `comment-${Date.now()}`,
      authorId: currentMember.id,
      content: commentDraft.trim(),
      createdAt: new Date().toISOString(),
      parentCommentId: replyTarget ?? undefined
    };

    onSave(
      posts.map((post) => (post.id === selectedPost.id ? { ...post, comments: [...post.comments, comment] } : post))
    );
    setCommentDraft("");
    setReplyTarget(null);
  };

  return (
    <div>
      <div className="view-header">
        <h1>Board</h1>
        <button className="btn btn-primary" onClick={() => setIsComposing(true)} type="button">
          글쓰기
        </button>
      </div>

      <div className="tabs">
        {categories.map((category) => (
          <button
            className={activeCategory === category ? "tab-button active" : "tab-button"}
            key={category}
            onClick={() => setActiveCategory(category)}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>

      {visiblePosts.length === 0 ? (
        <p className="empty-state">게시글이 없습니다.</p>
      ) : (
        visiblePosts.map((post) => (
          <div className="board-post-row" key={post.id} onClick={() => setSelectedPostId(post.id)}>
            {post.pinned ? <span className="badge badge-pinned">고정</span> : <span className="badge">{post.category}</span>}
            <div>
              <div className="board-post-title">{post.title}</div>
            </div>
            <span className="board-post-meta">{getAuthorName(post.authorId)}</span>
            <span className="board-post-meta">{formatDateTime(post.createdAt)}</span>
          </div>
        ))
      )}

      {isComposing && (
        <div className="modal-overlay" onClick={() => setIsComposing(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>새 게시글</h2>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label>카테고리</label>
                <select
                  onChange={(event) => setComposeCategory(event.target.value as BoardCategory)}
                  value={composeCategory}
                >
                  <option disabled={!isAdmin(currentMember)} value="공지">
                    공지 {isAdmin(currentMember) ? "" : "(admin 전용)"}
                  </option>
                  <option value="일반">일반</option>
                  <option value="요청">요청</option>
                  <option value="QnA">QnA</option>
                </select>
              </div>
              <div className="form-field">
                <label>제목</label>
                <input onChange={(event) => setComposeTitle(event.target.value)} value={composeTitle} />
              </div>
              <div className="form-field">
                <label>내용</label>
                <textarea onChange={(event) => setComposeContent(event.target.value)} value={composeContent} />
              </div>

              {composeCategory === "공지" && (
                <label className="board-pin-checkbox">
                  <input
                    checked={composePinned}
                    onChange={(event) => setComposePinned(event.target.checked)}
                    type="checkbox"
                  />
                  상단 고정
                </label>
              )}

              <div className="form-actions">
                <button
                  className="btn"
                  onClick={() => {
                    setIsComposing(false);
                    setComposePinned(false);
                  }}
                  type="button"
                >
                  취소
                </button>
                <button className="btn btn-primary" onClick={handleCreatePost} type="button">
                  등록
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPost && (
        <div className="modal-overlay" onClick={() => setSelectedPostId(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="badge">{selectedPost.category}</span>
                <h2 style={{ marginTop: 8 }}>{selectedPost.title}</h2>
                <span className="board-post-meta">
                  {getAuthorName(selectedPost.authorId)} · {formatDateTime(selectedPost.createdAt)}
                </span>
              </div>
              {selectedPost.category === "공지" && isAdmin(currentMember) && (
                <button className="btn btn-sm" onClick={() => togglePin(selectedPost.id)} type="button">
                  {selectedPost.pinned ? "고정 해제" : "상단 고정"}
                </button>
              )}
            </div>

            <p style={{ whiteSpace: "pre-wrap" }}>{selectedPost.content}</p>

            <div style={{ marginTop: 20 }}>
              <strong>댓글 ({selectedPost.comments.length})</strong>
              {selectedPost.comments.map((comment) => (
                <div
                  className={comment.parentCommentId ? "board-comment board-comment-reply" : "board-comment"}
                  key={comment.id}
                >
                  <div className="board-comment-meta">
                    {getAuthorName(comment.authorId)} · {formatDateTime(comment.createdAt)}
                  </div>
                  <div>{comment.content}</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setReplyTarget(comment.id)} type="button">
                    답글
                  </button>
                </div>
              ))}

              <div className="form-field" style={{ marginTop: 12 }}>
                {replyTarget && (
                  <span className="view-subtitle">
                    답글 작성 중 <button className="btn btn-ghost btn-sm" onClick={() => setReplyTarget(null)} type="button">취소</button>
                  </span>
                )}
                <textarea
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="댓글을 입력하세요"
                  value={commentDraft}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAddComment} type="button">
                  댓글 등록
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
