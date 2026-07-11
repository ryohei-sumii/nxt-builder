import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getUser } from '@/lib/data/users'
import { RecentOrders } from './recent-orders'

// patterns.md §6: generateMetadata。getUser は React.cache 済みで本体と取得を共有。
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const user = await getUser(id)
  if (!user) return {}
  return { title: `${user.name} さんのダッシュボード` }
}

// patterns.md §2: 読み取り経路でも認証＋所有チェック（IDOR 回避）。params は Promise（Next 16）。
export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/login') // 認証
  if (session.userId !== id) notFound() // 認可（他人の資源を覗かせない）
  const user = await getUser(id)
  if (!user) notFound()
  return (
    <main>
      <h1>{user.name} さんのダッシュボード</h1>
      {/* 遅い領域は分離してストリーミング */}
      <Suspense fallback={<p>注文を読み込み中…</p>}>
        <RecentOrders userId={id} />
      </Suspense>
    </main>
  )
}
