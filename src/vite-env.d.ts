/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 백엔드 서버 주소. 개발 기본값 http://localhost:3000, 배포 시 .env.production 에서 지정. */
  readonly VITE_API_URL?: string;
}
