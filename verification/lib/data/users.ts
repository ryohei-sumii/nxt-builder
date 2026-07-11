import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'

// patterns.md §2: リクエスト内重複排除（React.cache）+ 抽象境界。必要列のみ select する想定。
export const getUser = cache(async (id: string) => {
  const row = await db.user.findUnique({ where: { id } })
  if (!row) return null
  return { id: row.id, name: row.name } // DTO
})
