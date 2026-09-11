// 랭킹 조회 라우트. 제출 API 없음 — PUT /api/save 시 서버가 자동 계산(../rank.ts). 전체 Bearer 인증 필요.
import { Router } from 'express';
import { requireAuth } from '../auth';
import { getHallOfFame, getSeasonRanking } from '../rank';
import { currentSeasonId } from '../season';

export const rankRouter = Router();
rankRouter.use(requireAuth);

rankRouter.get('/', async (req, res) => {
  const season = typeof req.query.season === 'string' ? req.query.season : currentSeasonId();
  const entries = await getSeasonRanking(season);
  res.json({ season, entries });
});

rankRouter.get('/hall-of-fame', async (_req, res) => {
  const seasons = await getHallOfFame(currentSeasonId());
  res.json({ seasons });
});
