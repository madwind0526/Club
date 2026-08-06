# Patterns

> 검증된 코드 패턴. 복붙 바로 가능한 형태로 유지.

## IPC/fetch 이중 폴백 데이터 스토어

**사용 시점:** Electron IPC(`window.clubApp`)와 브라우저 전용 dev 서버(`/api/*`) 양쪽에서 동일 데이터 계층이 필요할 때.

```ts
export async function loadMembers(): Promise<Member[]> {
  const viaIpc = await window.clubApp?.listMembers?.();
  if (viaIpc) return viaIpc;
  const response = await fetch("/api/members");
  return response.ok ? response.json() : [];
}
```

## app-shell 그리드 레이아웃

**사용 시점:** 상단 타이틀바 + 좌측 사이드바 + 메인 영역 + 하단 시스템 메시지 4분할 레이아웃.

```css
.app-shell {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100vh;
}
```
