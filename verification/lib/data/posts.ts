import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import type { CreatePostData } from '@/lib/validation/post'

// readability-solid.md: UI はこの抽象（型）だけを知る（DIP）。実装は差し替え可能。
export interface PostRepository {
  byId(id: string): Promise<{ id: string; title: string; body: string; excerpt: string } | null>
  create(input: CreatePostData): Promise<{ id: string }>
}

// data-access.md: 認可・select・DTO 化は DAL 内で完結させる。ここでは必要列のみ返す DTO を作る。
export const posts: PostRepository = {
  byId: cache(async (id: string) => {
    const row = await db.post.findUnique({ where: { id } })
    if (!row) return null
    return { id: row.id, title: row.title, body: row.body, excerpt: row.excerpt } // DTO（authorId は返さない）
  }),
  create: async (input: CreatePostData) => {
    const row = await db.post.create({ data: input })
    return { id: row.id }
  },
}
