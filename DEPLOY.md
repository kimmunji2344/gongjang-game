# 배포 가이드 (M4 단계 B)

구성: **클라이언트** = itch.io(정적 HTML5) · **서버** = Render.com(무료 웹 서비스) · **DB** = MongoDB Atlas M0
서버·DB·호스팅은 각각 별개 서비스. Render 자체 무료 Postgres 는 절대 쓰지 않는다(30일 후 삭제).

---

## 1. GitHub 저장소 (사용자)

1. github.com → New repository → 이름 예: `gongjang-game`, **Private**, README/gitignore/license 는 추가하지 않음(빈 저장소)
2. 만든 뒤 저장소 URL(`https://github.com/<계정>/gongjang-game.git`)을 Claude 에게 전달
   → Claude 가 `git remote add origin <URL>` + `git push -u origin master` 실행

`server/.env` 는 `.gitignore` 에 있어 절대 올라가지 않는다. 커밋된 파일에 실제 연결문자열/키 없음(스캔 완료).

---

## 2. Render 배포 (사용자)

### 2-1. 가입
- render.com → GitHub 계정으로 가입 → private 저장소 접근 권한 허용

### 2-2. 서비스 생성 (Blueprint 방식 — 권장)
1. Dashboard → **New +** → **Blueprint**
2. `gongjang-game` 저장소 선택 → 루트의 `render.yaml` 자동 인식
3. `MONGODB_URI`, `JWT_SECRET` 입력란이 뜸 → **로컬 `server/.env` 의 값 그대로 복사해서 붙여넣기**
   - `server/.env` 열기: `notepad "C:\Users\User\Desktop\내파일\코딩 연습\공장게임\server\.env"`
   - `MONGODB_URI=` 뒷부분 전체 / `JWT_SECRET=` 뒷부분 전체
4. **Apply** → 빌드·배포 시작 (2~4분)

### 2-2. (대안) 수동 방식
New + → **Web Service** → 저장소 선택 → 아래대로 설정:
| 항목 | 값 |
|---|---|
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |
| Health Check Path | `/api/health` |

Environment 탭에서 `MONGODB_URI`, `JWT_SECRET` 추가 (`CORS_ORIGIN` 은 `*`). `PORT` 는 Render 가 자동 주입하므로 넣지 않음.

### 2-3. Atlas 확인
- MongoDB Atlas → Network Access 에 `0.0.0.0/0` 이 있는지 확인 (M4 단계 A 에서 이미 설정했으면 그대로)
- Render 는 고정 IP 가 없어 전체 허용이 필요. 대신 DB 비밀번호를 강하게.

### 2-4. 배포 완료
- 서비스 URL 확인: `https://gongjang-server-XXXX.onrender.com`
- 브라우저로 `https://gongjang-server-XXXX.onrender.com/api/health` → `{"ok":true}` 나오면 성공
- 이 URL 을 Claude 에게 전달 → Claude 가 클라 `.env.production` 채우고 빌드

> 무료 티어는 15분 미사용 시 슬립. 다음 첫 요청에 30~60초 걸림 → 게임 로딩 화면이 "최대 1분" 안내를 이미 표시함.

---

## 3. 클라이언트 프로덕션 빌드 (Claude)

1. 저장소 루트에 `.env.production` 생성: `VITE_API_URL=https://gongjang-server-XXXX.onrender.com`
2. `npm run build` → `dist/` 생성 (이 URL 이 번들에 박힘)

---

## 4. itch.io 업로드 (사용자)

1. `dist/` 폴더를 zip 으로 압축 (폴더 자체가 아니라 **안의 내용**이 zip 최상위에 오도록)
2. itch.io → 프로젝트 → Uploads → zip 업로드
3. 옵션:
   - **This file will be played in the browser** 체크
   - Embed 크기: 800 × 600 (또는 취향)
   - **Mobile friendly** 체크 (터치 지원)
   - **Fullscreen button** 체크
4. 저장 후 페이지에서 플레이 테스트: 회원가입 → 로그인 → 진행 → "저장" → 새로고침 시 복원

---

## 재배포

- 서버 코드 변경 → `git push` → Render 가 자동 재배포 (`autoDeploy: true`)
- 클라 코드 변경 → `npm run build` → 새 `dist/` zip 을 itch.io 에 재업로드
- 세이브 포맷(`SAVE_VERSION`) 이 바뀌면 클라 `normalizeState` 가 구버전 세이브를 흡수 (현재 v4)
