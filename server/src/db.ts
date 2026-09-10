// MongoDB Atlas 연결 + 컬렉션 핸들. db 이름은 연결 문자열과 무관하게 'gongjang' 고정.
import { Collection, Db, MongoClient } from 'mongodb';
import { requireEnv } from './env';

export type UserDoc = { _id: string; pwHash: string; createdAt: Date };
export type SaveDoc = { _id: string; v: number; state: unknown; updatedAt: Date };

let db: Db | null = null;

export async function connectDb(): Promise<void> {
  // .trim() 으로 앞뒤 공백·BOM 제거 (대시보드에 값 붙여넣을 때 흔한 실수).
  const uri = requireEnv('MONGODB_URI').trim();
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    const scheme = uri.includes('://') ? uri.slice(0, uri.indexOf('://') + 3) : uri.slice(0, 15);
    throw new Error(
      `MONGODB_URI 형식 오류 — "mongodb+srv://" 로 시작해야 합니다. ` +
        `현재 시작 부분: "${scheme}" · 'MONGODB_URI=' 접두어나 따옴표가 붙지 않았는지 확인하세요.`,
    );
  }
  const client = new MongoClient(uri);
  await client.connect();
  db = client.db('gongjang');
  await db.command({ ping: 1 });
  console.log('MongoDB 연결됨 (db: gongjang)');
}

function coll<T extends { _id: string }>(name: string): Collection<T> {
  if (!db) throw new Error('DB 미연결 — connectDb() 를 먼저 호출하세요');
  return db.collection<T>(name);
}

export const users = (): Collection<UserDoc> => coll<UserDoc>('users');
export const saves = (): Collection<SaveDoc> => coll<SaveDoc>('saves');
