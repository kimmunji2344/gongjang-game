/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // itch.io 상대경로 배포용
  build: { target: 'es2022' },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
