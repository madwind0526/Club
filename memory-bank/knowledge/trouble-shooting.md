# Trouble Shooting

> 발생했던 버그와 해결 방법. 같은 문제를 두 번 겪지 않기 위한 기록.

<!--
예시 형식:

## [문제 제목]

### 증상

[어떤 에러 또는 현상이 나타났나]

### 원인

[왜 발생했나]

### 해결

[어떻게 고쳤나 — 코드/명령어 포함]

-->

## 전체 배열 저장 API 권한 우회

### 증상

Renderer UI에서는 일반 회원의 권한이 제한되어 있어도, Electron IPC나 `/api/*` fallback을 직접 호출하면 전체 배열 저장 방식의 데이터를 우회 수정할 수 있다.

### 원인

`activities:save` / board 저장 API가 클라이언트에서 넘어온 전체 배열을 신뢰했다. 활동 목록 검증은 길이와 next id 존재 여부만 비교해 중복 id 배열로 삭제를 숨길 수 있었고, 게시판 저장은 서버 측 diff 검증 없이 `writeJson`을 실행했다.

### 해결

`server/auth.ts`에 공통 권한 helper를 둔다. 전체 배열 저장 전에는 id 중복, current/next id set 양방향 비교, 게시판 immutable field 변경, 타인 글 삭제/수정, 공지/고정 위조, 댓글 author 위조를 서버에서 다시 검증한다. Electron IPC와 Vite dev API는 같은 helper를 import해 동일하게 적용한다.

## Electron stale localStorage 세션 우회

### 증상

Electron 앱 재시작 후 main process의 세션은 비어 있는데 renderer localStorage에 남은 사용자 정보만으로 앱 shell이 표시되고, 일부 list IPC가 인증 없이 데이터를 반환할 수 있다.

### 원인

renderer의 `fetchServerSession()`이 Electron에서는 실제 IPC 세션 확인 없이 `loadSession()`만 반환했고, `members:list` / `activities:list` / `board:list` IPC가 `requireMember()`를 호출하지 않았다.

### 해결

`auth:session` IPC를 추가해 main process의 실제 `currentSessionMemberId`를 확인한다. 보호 데이터 list IPC에는 `requireMember()`를 적용하고, `App.tsx`는 설정만 먼저 로드한 뒤 세션이 확인된 경우에만 회원/활동/게시판 데이터를 요청한다.

## UTC 기준 날짜 잘림으로 활동 상태 오판

### 증상

한국 시간 오전 0시부터 9시 전까지 오늘 날짜의 활동이 `예정`으로 보일 수 있다.

### 원인

`new Date().toISOString().slice(0, 10)`은 로컬 날짜가 아니라 UTC 날짜를 반환한다.

### 해결

클라이언트 날짜 비교와 활동 등록 기본값은 `getFullYear()` / `getMonth()` / `getDate()` 기반의 로컬 `YYYY-MM-DD` helper를 사용한다.
