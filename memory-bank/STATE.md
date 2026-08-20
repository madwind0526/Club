# State

## Current Wave

- **Wave:** 25
- **Status:** Ready
- **Cache Status:** CLEAN
- **Last Checkpoint:** 월간 정리 Report 컬럼 center 정렬 복구 / npm run build 통과

## Wave History

| Wave | 작업 내용 | 상태 |
|------|-----------|------|
| 1 | 프로젝트 기본 구조 스캐폴딩 (SNS-Reader 구조 참고) | Done |
| 2 | 활동 리포트 참석자 추가 UI를 전체 회원 체크박스 팝업으로 변경 | Done |
| 3 | 게시판 글 삭제 권한을 admin 또는 작성자 본인 기준으로 보강 | Done |
| 4 | 활동 리스트/주간 정리 제목+주차 한 줄 표시, 게시판 리스트 삭제 버튼 배치 | Done |
| 5 | 활동 리스트/주간 정리 참석자 수·상태 컬럼 가운데 정렬 | Done |
| 6 | 월간 정리 테이블 가운데 정렬, Home 행사 제목+주차 한 줄 표시 | Done |
| 7 | 회원관리 주요 컬럼 가운데 정렬 및 테이블 가로 스크롤 적용 | Done |
| 8 | 회원관리 x 스크롤바가 화면 안에 보이도록 스크롤 영역 보강 | Done |
| 9 | 회원관리 중복 y 스크롤 제거 및 단일 테이블 스크롤 처리 | Done |
| 10 | 활동 등록 화면 참석자 선택 UI 및 attendeeIds 저장 연결 | Done |
| 11 | 참석자 선택 팝업 이름+Knox ID 한 줄 표시 | Done |
| 12 | 활동 리포트 참석자 선택 팝업에서 기존 참석자 변경 가능 | Done |
| 13 | 활동 리포트 참석자 목록 삭제 버튼 아이콘화 | Done |
| 14 | 월간 정리 상세 요약/참석표 정렬 보정 | Done |
| 15 | 월간 정리 상세 영수증/경비 날짜·가격 정렬 보정 | Done |
| 16 | 월간 정리 상세 영수증/경비 날짜 정렬 원복 | Done |
| 17 | 월간 정리 상세 영수증/경비 내역 번호 컬럼 추가 | Done |
| 18 | 월간 정리 목록 Excel 리포트 아이콘 및 이전 파일 열기 연결 | Done |
| 19 | 월간 정리 목록 Report 컬럼 추가 및 Excel 아이콘 확대 | Done |
| 20 | 월간 정리 목록 Report 컬럼 폭 축소 | Done |
| 21 | 월간 정리 목록 Report 컬럼/아이콘 center 정렬 보정 | Done |
| 22 | 월간 정리 Report 컬럼 Playwright 정렬 측정 및 icon slot center 보강 | Done |
| 23 | 월간 정리 Report 컬럼 폭/배치 보정 | Done |
| 24 | 월간 정리 Report 컬럼 left 정렬 변경 | Done |
| 25 | 월간 정리 Report 컬럼 center 정렬 복구 | Done |

## Session Notes

- Electron + React + TS + Vite 스캐폴딩, 로컬 JSON 저장 계층, 그레이스케일 디자인, 12개 화면(Login/Home/Activities/ActivityDetail/ActivityRegister/ActivityReport/Board/Members/WeeklyReport/MonthlyReport/Settings/Profile) 구현 완료
- 주간/월간 정리는 placeholder만 존재 (범위 밖)
- 활동 리포트 참석자 추가는 전체 활성 회원 목록 팝업에서 체크 후 확인하는 방식으로 동작
- 게시판 글 삭제는 admin 또는 작성자 본인만 버튼이 보이며, 삭제 실행 함수에서도 같은 권한을 확인
- 활동 리스트/주간 정리의 제목+주차는 공용 `ActivityListTable`에서 한 줄로 표시
- 게시판 리스트 삭제 버튼은 날짜 오른쪽에 표시되며 클릭 시 삭제 확인 팝업만 열림
- 활동 리스트/주간 정리의 참석자 수·상태 컬럼은 header/body 모두 가운데 정렬
- 월간 정리 테이블은 header/body 모두 가운데 정렬
- Home 완료된 행사/예정된 행사 카드의 제목+주차는 한 줄로 표시
- 회원관리 테이블은 최소 폭 1120px과 가로 스크롤 wrapper를 사용하고, 가입 날짜·회원 등급·역할 컬럼은 가운데 정렬
- 회원관리 테이블 wrapper는 viewport 안에 x 스크롤바가 보이도록 max-height와 커스텀 scrollbar 스타일을 사용
- 회원관리 화면은 outer main-window y 스크롤 없이 테이블 wrapper 하나만 x/y 스크롤을 담당
- 활동 등록 화면에서 활성 회원을 체크 팝업으로 선택하고 신규 활동의 attendeeIds에 저장
- 참석자 선택 팝업의 이름+Knox ID는 한 줄로 표시하고 Knox ID는 기존 작은 muted 스타일 유지
- 활동 리포트/주간 정리 참석자 선택 팝업은 기존 참석자도 enabled 체크박스로 표시해 참석 여부를 변경 가능
- 주간 정리/활동 리포트 참석자 목록의 삭제 버튼은 텍스트 대신 Trash 아이콘 버튼으로 표시
- 월간 정리 상세 참석표는 번호·차수·합 center, 후원금액 right 정렬이며 요약 라벨/값은 같은 크기로 가운데 정렬
- 월간 정리 상세 영수증/경비 내역은 날짜 기본 left 정렬, 가격 right 정렬
- 월간 정리 상세 영수증/경비 내역은 날짜 앞 번호 컬럼을 표시하고 번호는 center 정렬
- 월간 정리 상세에서 Excel 내보내기 성공 시 월별 파일 경로를 기억하고, 월간 정리 목록 총 참석 인원 옆 Excel 아이콘으로 해당 파일을 열 수 있음
- 월간 정리 목록은 별도 Report 컬럼에 더 큰 Excel 아이콘을 표시
- 월간 정리 목록 Report 컬럼 폭은 56px로 고정
- 월간 정리 목록 Report 헤더/셀/아이콘은 center 정렬
- Playwright 측정상 Report 헤더/셀은 center, icon slot center delta는 0
- 월간 정리 목록 Report 컬럼은 12% 폭의 fixed layout 컬럼으로 표시해 우측 끝 밀착감을 줄임
- 월간 정리 목록 Report 헤더/셀/아이콘 slot은 center 정렬
