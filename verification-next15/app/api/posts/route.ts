import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'

// 認可付き Route Handler。先頭で認証 → Zod 検証 → 適切なステータス（版に依らない）。
// 版差メモ: Next 15 では GET Route Handler は既定で「非キャッシュ」（14 の既定キャッシュから変更）。
//          明示したいときは従来どおり export const dynamic / revalidate を使う。
export const dynamic = 'force-dynamic'

const CreateSchema = z.object({ title: z.string().min(1).max(200), body: z.string().min(1) })

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  // authorId はセッション由来（クライアントから受けない）
  return NextResponse.json({ id: 'p_1', ...parsed.data, authorId: session.userId }, { status: 201 })
}
