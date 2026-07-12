import 'server-only'
import { cache } from 'react'

// スタブ DAL: 実際は ORM。必要列のみ select して DTO 化する想定（authorId 等は返さない）。
// リクエスト内の重複取得は React.cache で排除（版に依らず有効）。
export const getUser = cache(async (id: string) => {
  if (id !== 'u_1') return null
  return { id, name: 'サンプルユーザー' } // DTO
})
