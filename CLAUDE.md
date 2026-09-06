# 공장게임

2D 탑뷰 아이들/타이쿤 게임. Phaser 3 + TypeScript + Vite. itch.io(HTML5) 배포 예정.

## 사양서 = Obsidian (유일한 기준, 수시로 변경됨)
경로: C:\Users\User\Desktop\내파일\프로그램 파일\munji2344\공부\코딩\공장게임\
- 공장게임.md — 마스터 기획
- 공장 게임 용어 정리.md — 용어 / 자원
- 공장 게임 CANVAS.canvas — 배치 목업
- Cobe.md — 코드 변경 요약 로그 (작업마다 갱신)

## 작업 규칙 (사용자 지정 2026-09-06)
1. 코딩 시작 시 위 Obsidian 폴더 전체 재확인. 변경 있으면 반영.
2. 불명확 / 확인필요 사항은 코드 쓰기 전 전부 질문 (누락 금지).
3. 디자인은 M7에서 일괄 교체 — 지금은 임의 플레이스홀더. 디자인 변경이 게임 로직에 영향 가면 반드시 사전 확인 / 보고.
4. 코드 변경 시 채팅에 상세 설명 + Cobe.md에 요약 추가.
5. 미확정 수치는 src/data/ 에서만 관리. 현재 전부 임시값 10.

## 구조
- src/data/  — config / resources / speed (데이터 표, 하드코딩 금지)
- src/sim/   — grid(타일·설치물), sim(틱 시뮬·경로탐색·배치). Phaser 비의존 순수 TS
- src/scenes/— FactoryScene (렌더 + 입력, 플레이스홀더 그래픽)
- test/      — vitest (sim 로직만)

## 명령
- npm run dev    개발 서버
- npm run build  타입체크 + 빌드
- npm test       로직 테스트

## 현재: M1 (로컬 코어 루프). 서버 / 계정 / 세이브 없음.
