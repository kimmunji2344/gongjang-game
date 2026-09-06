// gongjang-server 엔트리. Express + CORS + 라우트. DB 연결 성공 후에만 listen.
import './loadEnv'; // 반드시 첫 줄 — 아래 모듈들이 process.env 를 읽는다
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { connectDb } from './db';
import { authRouter } from './routes/auth';
import { saveRouter } from './routes/save';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' })); // Bearer 토큰 인증이라 쿠키/CSRF 없음
app.use(express.json({ limit: '512kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api/auth', authRouter);
app.use('/api/save', saveRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('처리되지 않은 오류:', err);
  res.status(500).json({ error: '서버 오류' });
});

// SERVER_PORT(로컬 .env) 우선, 없으면 PORT(Render가 주입), 없으면 3000.
// 'PORT'만 쓰면 다른 툴(Vite 등)이 넣어둔 값과 충돌할 수 있어 전용 변수를 먼저 본다.
const PORT = Number(process.env.SERVER_PORT ?? process.env.PORT ?? 3000);
connectDb()
  .then(() => {
    app.listen(PORT, () => console.log(`gongjang-server http://localhost:${PORT}`));
  })
  .catch((e: unknown) => {
    console.error('DB 연결 실패 — 서버를 종료합니다:', e);
    process.exit(1);
  });
