// MongoDB Atlas 연결 + 컬렉션 핸들. db 이름은 연결 문자열과 무관하게 'gongjang' 고정.
import { Collection, Db, MongoClient } from 'mongodb';
import { requireEnv } from './env';

export type UserDoc = { _id: string; pwHash: string; createdAt: Date };
export type SaveDoc = { _id: string; v: number; state: unknown; updatedAt: Date };

let db: Db | null = null;

export async function connectDb(): Promise<void> {
  const client = new MongoClient(requireEnv('MONGODB_URI'));
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
