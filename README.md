# Club Management

사내/사외 동호회 운영을 위한 Electron 데스크톱 앱입니다. 회원 관리, 활동 일정과 참석 체크, 게시판, 주간/월간 활동 정리(Excel 내보내기 포함)를 한 곳에서 처리합니다.

## 주요 기능

### Home
- 클럽 로고/소개, 총 회원수·올해 활동 수·참가 인원 통계 카드(클릭 시 회원 관리/Activities로 이동)
- 완료된 행사 / 예정된 행사 요약(각 최대 5건) — 날짜, 주차, 참석자 수 표시

### Activities
- Photo / Card / List 3가지 보기, 검색
- 완료(초록)·예정(파랑) 상태 뱃지
- 완료된 활동 클릭 → "상세 내역 확인" 팝업 / 예정된 활동 클릭 → "참가 신청"(누구나) · "활동등록"(admin) 팝업

### 활동 등록 & 상세 리포트 (팝업)
- 제목/날짜/주차, 활동 내용, 참석자 추가·삭제
- **활동 계획서**: 여러 파일을 첨부할 수 있음 — 수동 첨부(추가) 또는 `Plan` 폴더에서 파일명 규칙에 맞는 **모든** 파일을 자동으로 찾아 추가, 썸네일(이미지/문서 아이콘)로 표시 — 클릭 시 이미지·PDF는 팝업 미리보기, 문서 파일(doc/xls/ppt)은 OS 기본 프로그램으로 열림, 개별 삭제 가능
- 사진·영수증·경비 사진을 폴더에서 불러오기(재스캔 시 기존 목록에 병합, 개별 삭제 가능) + 클릭 시 원본 크게보기
- 영수증/경비 내역 표(추가/삭제)
- 활동을 등록하면 해당 월/주차의 Photos·Receipts·Expenses(·Plan) 폴더가 자동으로 생성됨

### Board
- 공지/일반/요청/QnA, 공지 상단 고정(admin), 댓글과 대댓글

### 회원 관리 (admin 전용)
- 회원 추가/수정/삭제, 추가 시 초기 비밀번호 지정 가능(비워두면 Knox ID)
- **불러오기**: 파일 선택 창에서 직접 선택 / **자동불러오기**: Settings에 지정한 회원 파일(비워두면 `assets/members.json` 또는 `assets/members.txt`)을 자동으로 읽음 / **내보내기**
- Settings에서 형식(JSON ↔ 탭으로 구분된 TXT)과 방식(추가/교체)을 선택하면 세 버튼 모두 그 설정을 따름
- 불러오기/자동불러오기 시 "초기 비밀번호"를 입력하면 admin 포함 모든 가져온 회원에게 그 비밀번호가 설정됨(비워두면 각자 Knox ID)
- 추가 시 Knox ID가 이미 있으면 자동으로 건너뜀

### 주간 정리 (admin 전용)
전체 활동을 List View로 모아보고 클릭 시 바로 상세 리포트 팝업으로 이동합니다.

### 월간 정리
한 달의 모든 활동을 하나로 종합합니다.
- 전체 회원의 1차·2차·... 출석 현황(O 표시) + 참석 횟수에 따른 활동비(1회/2회 이상 금액은 Settings에서 설정, 기본 5,000원/10,000원) 자동 계산
- 사진 / 영수증 사진·내역 / 경비 사진·내역을 주차별로 모아서 표시
- **Excel로 내보내기** — `.xlsx` 한 파일에 아래 시트를 생성 (모든 표에 테두리 적용)
  - **Summary**: 큰 제목("[YY년 M월] {보고서 클럽 이름} 활동 보고", Settings에서 클럽 이름 설정) 아래 사진 / 참여인원(전체 회원 출석표 + "활동비 합" 1x2) / 영수증(사진+"행사 경비 신청 금액 합" 1x2+내역 표) / 경비(사진+"행사 경비 지출 금액 합" 1x2+내역 표) 순서로 나란히 배치
  - **N주차** (활동이 있는 주만): Summary와 동일한 순서·형식으로 활동별 패널 구성(참여인원은 그 활동의 실제 참석자만 표시), 위쪽에 제목·활동 계획서·날짜·내용·참석 인원 정리
  - **영수증** / **경비**: 월 전체 사진(주차별)과 통합 내역 표
  - **회원 목록**: 전체 회원 표

### 로그인 / Profile
- Knox ID + 비밀번호, 회원 등급(회장/총무/감사/정회원)과 역할(admin/일반) 기반 권한
- Profile 화면에서 본인 이름/부서/비고 수정 및 비밀번호 변경 가능

### Settings
- 클럽 이름/로고/소개, 데이터 루트 폴더(+ Photos/Receipts/Expenses/Plan 개별 폴더 경로 재정의, 비워두면 데이터 루트 폴더 하위 사용)
- 보고서 클럽 이름(월간 정리 Excel 제목에 사용), 1회/2회 이상 참석 활동비 금액
- 회원 불러오기 형식/방식, 회원 자동불러오기 파일 경로(비워두면 assets/members.json·txt)
- 테마(라이트/다크, 버튼 클릭 시 즉시 적용)

## 기술 스택

- Electron + React + TypeScript + Vite
- 엑셀 생성: [ExcelJS](https://github.com/exceljs/exceljs)
- 데이터는 로컬 JSON 파일(`data/runtime/`)로 저장 — 별도 데이터베이스 없음
- 렌더러는 Electron IPC(`window.clubApp`)를 우선 사용하고, 브라우저 전용 `npm run dev` 모드에서는 Vite 미들웨어가 제공하는 `/api/*`로 동일하게 동작
- 로컬 이미지/파일은 `club-media://` 커스텀 프로토콜을 통해 렌더러에 안전하게 전달됨 (자세한 내용은 [`CLAUDE.md`](CLAUDE.md) 참고)

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

로그인 후 Profile 또는 회원 관리에서 실제 정보로 수정하고 비밀번호를 변경하는 것을 권장합니다.

### 사진 / 영수증 / 경비 / 계획서 폴더

Settings의 "데이터 루트 폴더"를 지정하면 아래 구조에서 자동으로 파일을 찾습니다. Photos/Receipts/Expenses/Plan은 Settings에서 개별 경로로 재정의할 수도 있습니다(비워두면 데이터 루트 폴더 하위 사용).

```
<데이터 루트 폴더>/
  Photos/YYYY-MM/WeekN/         예: Photos/2026-07/Week3/*.jpg
  Receipts/YYYY-MM/WeekN/
  Expenses/YYYY-MM/WeekN/
  Plan/YYYY-MM-WeekN.<확장자>    예: Plan/2026-07-Week3.jpg, 2026-07-Week3_사진.png
```

- Photos/Receipts/Expenses는 해당 폴더 안의 모든 이미지 파일(jpg/jpeg/png/gif/webp/bmp)을 불러옵니다.
- Plan은 파일명이 `YYYY-MM-WeekN`으로 **시작하는 모든** 파일을 찾아 한 번에 첨부합니다(확장자별로 여러 개 있어도 전부 불러옴). 지원 확장자: jpg, jpeg, gif, png, doc, docx, xls, xlsx, ppt, pptx, pdf.
- 활동을 등록하면 위 Photos/Receipts/Expenses(YYYY-MM/WeekN)와 Plan 폴더가 없을 경우 자동으로 생성됩니다.

### 회원 자동불러오기 (`assets/`)

Settings에서 형식을 TXT로 두면 `assets/members.txt`(탭으로 구분, 엑셀의 "텍스트(탭으로 구분)" 저장 형식과 동일), JSON으로 두면 `assets/members.json`을 회원 관리 화면의 "자동불러오기" 버튼이 읽습니다. Settings의 "회원 자동불러오기 파일 경로"를 지정하면 그 경로를 대신 읽습니다. 열 순서: 이름, Knox ID, 부서, 연락처, 가입 날짜, 회원 등급, 역할, 비고.

## 저장소에 포함된 예시 데이터

- `data/runtime/` — 샘플 회원·활동·게시판 데이터 (앱이 그대로 읽고 씁니다)
- `assets/` — 클럽 로고, 회원 자동불러오기용 샘플 `members.txt`
- `Input/` — Settings의 "데이터 루트 폴더"로 지정해 테스트해 본 샘플 사진/영수증/경비/계획서 폴더
- `Report/` — 월간 정리 Excel 내보내기 결과 예시
- `screenshot/` — 앱 화면 스크린샷

## 주요 명령어

```bash
npm run dev      # Vite 개발 서버만 (브라우저)
npm start        # Electron 메인 빌드 + Vite 개발 서버 + Electron 창 실행
npm run build    # 프로덕션 빌드 (tsc -b && vite build && tsc -p tsconfig.node.json)
```

## 프로젝트 구조

자세한 아키텍처와 개발 규칙은 [`CLAUDE.md`](CLAUDE.md)를 참고하세요.
