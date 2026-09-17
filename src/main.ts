import './ui/theme.css';
import { runPreGameFlow } from './ui/screens';
import { startFactory } from './game';

runPreGameFlow()
  .then(({ userId, save }) => startFactory(userId, save))
  .catch((err: unknown) => {
    console.error('시작 실패:', err);
    document.body.innerHTML =
      '<p style="color:#c00;font-family:sans-serif;padding:24px">' +
      '시작 중 오류가 발생했습니다. 새로고침 해주세요.</p>';
  });
