import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

// data-access.md: セッション検証を集約し、React.cache で同一リクエスト内 1 回に抑える。
export const verifySession = cache(async () => {
  const session = await auth()
  if (!session) redirect('/login') // 未認証は集約地点で弾く
  return { userId: session.userId, role: session.role }
})
