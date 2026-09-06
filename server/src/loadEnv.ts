// index.ts 최상단에서 import — 다른 모듈이 process.env 를 읽기 전에 server/.env 를 로드한다.
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // .env 파일이 없으면 배포 환경(Render 등)의 실제 환경변수를 그대로 사용
}
