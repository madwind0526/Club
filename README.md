# Club Management

사내/사외 동호회 운영을 위한 Electron 데스크톱 앱입니다. 회원 관리, 활동 일정과 참석 체크, 게시판, 주간/월간 활동 정리를 한 곳에서 처리합니다.

## 주요 기능

- **Home** — 클럽 로고/소개, 총 회원수·올해 활동 수·참가 인원 통계 카드, 완료/예정 행사 요약(각 최대 5건)
- **Activities** — Photo / Card / List 3가지 보기, 검색, 완료·예정 상태 뱃지(색상으로 구분)
- **활동 등록 & 상세 리포트** — 제목/날짜/주차/활동 계획서 첨부(수동 첨부 또는 `Plan` 폴더에서 파일명 규칙으로 자동 첨부), 참석자 추가/삭제, 사진·영수증·경비 사진을 폴더에서 불러오기(개별 삭제 가능) + 원본 크게보기, 영수증/경비 내역 표
- **Board** — 공지/일반/요청/QnA, 공지 상단 고정(admin), 댓글과 대댓글
- **회원 관리** — 회원 CRUD, JSON 파일로 불러오기/내보내기 (admin 전용)
- **주간 정리** (admin 전용) — 전체 활동을 List View로 모아보고 클릭 시 바로 상세 리포트 팝업
- **월간 정리** — 한 달의 모든 활동을 하나로 종합: 주차별 사진/영수증/경비 사진, 합산된 영수증·경비 표, 참석자별 차수 출석 현황 + 참석 횟수에 따른 후원금액(1회 5만원 / 2회 이상 10만원) 자동 계산
- **로그인** — Knox ID + 비밀번호, 회원 등급(회장/총무/감사/정회원)과 역할(admin/일반) 기반 권한
- **Settings** — 클럽 이름/로고/소개, 사진·영수증·경비·계획서 데이터 루트 폴더, 라이트/다크 테마(즉시 적용)

## 기술 스택

- Electron + React + TypeScript + Vite
- 데이터는 로컬 JSON 파일(`data/runtime/`)로 저장 — 별도 데이터베이스 없음
- 렌더러는 Electron IPC(`window.clubApp`)를 우선 사용하고, 브라우저 전용 `npm run dev` 모드에서는 Vite 미들웨어가 제공하는 `/api/*`로 동일하게 동작

## 시작하기

```bash
npm install
npm start        # Electron 앱 실행 (권장)
```

브라우저에서 UI만 확인하려면:

```bash
npm run dev       # http://127.0.0.1:5173
```

### 최초 로그인

앱을 처음 실행하면 회원 데이터가 비어 있을 경우 관리자 계정이 자동 생성됩니다.

- Knox ID: `admin`
- 비밀번호: `admin1234`

로그인 후 회원 관리에서 실제 정보로 수정하고 비밀번호를 변경하는 것을 권장합니다.

### 사진 / 영수증 / 경비 / 계획서 폴더

Settings의 "데이터 루트 폴더"를 지정하면 아래 구조에서 자동으로 파일을 찾습니다.

```
<데이터 루트 폴더>/
  Photos/YYYY-MM/WeekN/
  Receipts/YYYY-MM/WeekN/
  Expenses/YYYY-MM/WeekN/
  Plan/YYYY-MM-WeekN_*.{jpg,png,xls,xlsx,ppt,pptx,doc,docx}
```

## 주요 명령어

```bash
npm run dev      # Vite 개발 서버만 (브라우저)
npm start        # Electron 메인 빌드 + Vite 개발 서버 + Electron 창 실행
npm run build    # 프로덕션 빌드 (tsc -b && vite build && tsc -p tsconfig.node.json)
```

## 프로젝트 구조

자세한 아키텍처와 개발 규칙은 [`CLAUDE.md`](CLAUDE.md)를 참고하세요.
