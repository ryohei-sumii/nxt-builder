import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { posts } from '@/lib/data/posts'

// patterns.md §3: 認可付き Route Handler。先頭で認証 → Zod 検証 → 適切なステータス。
const CreateSchema = z.object({ title: z.string().min(1).max(200), body: z.string().min(1) })

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const created = await posts.create({ ...parsed.data, authorId: session.userId })
  return NextResponse.json(created, { status: 201 })
}
